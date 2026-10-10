"use client";

// Кабинет: верхняя панель, список блоков, редактор выбранного блока, история.
// Черновик живёт в памяти страницы до «Сохранить»; блоки можно переключать без потерь.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BLOCKS, describePath, parseApiError, splitPath, type BlockId, type FieldError } from "@/lib/admin/fields";
import type { AdminLang } from "@/lib/admin/i18n";
import { validateGallery, validateSiteContent, type GalleryItem, type SiteContent } from "@/lib/content/schema";
import { withBase } from "@/lib/media";
import { ApiError, INBOX_ID, listLeads, loadContent, mailCounts, logout, saveContent, setUnauthorizedHandler, type Versions } from "./api";
import { AnchorDatalist, ErrorsContext, FieldsEditor, fieldId, type ErrorsApi, type Update } from "./fields-editor";
import { GalleryEditor } from "./gallery-editor";
import { AdminLangProvider, LangSwitch, useT } from "./i18n";
import { HistoryView } from "./history-view";
import { LeadsView } from "./leads-view";
import { LoginForm } from "./login-form";
import { MailView } from "./mail-view";
import { MediaLibraryProvider, useLibrary } from "./media";
import { AdminUiProvider, Dialog, useUi } from "./ui";
import "./admin.css";

type View = BlockId | "history" | "leads" | "mail";
/** Как часто обновлять счётчики непрочитанных в меню. */
const UNREAD_POLL_MS = 60_000;
type Obj = Record<string, unknown>;

/* Сервисные блоки — не секции страницы, а общие для всего сайта данные. */
const SHARED_BLOCKS = new Set<BlockId>(["contacts", "nav", "footer", "loader", "meta"]);

export type AdminAppProps = { site: SiteContent; gallery: GalleryItem[]; versions: Versions; instagramLive: number; lang: AdminLang };

export function AdminApp(props: AdminAppProps) {
  return (
    <AdminLangProvider initial={props.lang} titleKey="meta.adminTitle">
      <AdminRoot {...props} />
    </AdminLangProvider>
  );
}

function AdminRoot(props: AdminAppProps) {
  const { lang } = useT();
  const [site, setSite] = useState(props.site);
  const [gallery, setGallery] = useState(props.gallery);
  // Последнее сохранённое состояние: с ним сравнивается черновик.
  const [savedSite, setSavedSite] = useState(props.site);
  const [savedGallery, setSavedGallery] = useState(props.gallery);

  /* Файл стоит только в несохранённых правках — сервер о них не знает и дал бы его
     удалить. Если файл уже в сохранённом контенте, отказ с подробностями даст сервер (409). */
  const usedInDraft = useCallback(
    (path: string) => {
      const needle = JSON.stringify(path);
      const inDraft = JSON.stringify(site).includes(needle) || JSON.stringify(gallery).includes(needle);
      const inSaved = JSON.stringify(savedSite).includes(needle) || JSON.stringify(savedGallery).includes(needle);
      return inDraft && !inSaved;
    },
    [site, gallery, savedSite, savedGallery],
  );
  const state = { site, setSite, gallery, setGallery, savedSite, setSavedSite, savedGallery, setSavedGallery };
  return (
    <div className="adm" lang={lang}>
      <AdminUiProvider>
        <MediaLibraryProvider isUsedInDraft={usedInDraft}>
          <Cabinet instagramLive={props.instagramLive} initialVersions={props.versions} {...state} />
        </MediaLibraryProvider>
      </AdminUiProvider>
    </div>
  );
}

type Setter<T> = (fn: T | ((prev: T) => T)) => void;
type ContentState = {
  site: SiteContent;
  setSite: Setter<SiteContent>;
  gallery: GalleryItem[];
  setGallery: Setter<GalleryItem[]>;
  savedSite: SiteContent;
  setSavedSite: Setter<SiteContent>;
  savedGallery: GalleryItem[];
  setSavedGallery: Setter<GalleryItem[]>;
};

function errorsApi(errors: FieldError[], file: FieldError["file"], setErrors: (fn: (prev: FieldError[]) => FieldError[]) => void): ErrorsApi {
  return {
    at: (path) => errors.filter((error) => error.file === file && error.path === path).map((error) => error.message),
    clear: (path) =>
      setErrors((prev) => {
        const next = prev.filter(
          (error) => error.file !== file || !(error.path === path || error.path.startsWith(`${path}.`) || error.path.startsWith(`${path}[`)),
        );
        return next.length === prev.length ? prev : next;
      }),
  };
}

/**
 * Ошибки после смены языка: те же места, тексты заново из проверки схемы на новом языке.
 * Место, которое проверка уже не находит (поле успели поправить, ошибка особая), остаётся как было.
 */
function relocalizeErrors(errors: FieldError[], site: SiteContent, gallery: GalleryItem[], lang: AdminLang): FieldError[] {
  if (!errors.length) return errors;
  const fresh = [...validateSiteContent(site, lang), ...validateGallery(gallery, lang)].map(parseApiError);
  const keyOf = (error: FieldError) => `${error.file}:${error.path}`;
  const seen = new Set<string>();
  const result: FieldError[] = [];
  for (const error of errors) {
    const key = keyOf(error);
    if (seen.has(key)) continue;
    seen.add(key);
    const same = fresh.filter((candidate) => keyOf(candidate) === key);
    result.push(...(same.length ? same : errors.filter((old) => keyOf(old) === key)));
  }
  return result;
}

/** Прокрутка к полю с ошибкой: само поле, иначе ближайший предок по пути. */
function revealField(file: FieldError["file"], path: string) {
  // Два кадра: сначала React дорисует блок, на который переключились.
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    const tokens = splitPath(path);
    for (let length = tokens.length; length > 0; length -= 1) {
      const at = tokens.slice(0, length).reduce<string>((acc, token) => (typeof token === "number" ? `${acc}[${token}]` : acc ? `${acc}.${token}` : token), "");
      const id = fieldId(at);
      const target =
        document.getElementById(id) ??
        document.getElementById(`${id}-title`) ??
        document.querySelector<HTMLElement>(`[data-path="${at}"], [data-item="${id}"]`);
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        const focusable = target.matches("input, textarea, select, button") ? target : target.querySelector<HTMLElement>("input, textarea, select, button");
        focusable?.focus({ preventScroll: true });
        return;
      }
    }
    if (file === "gallery") document.getElementById("gallery-items-title")?.scrollIntoView({ block: "start" });
  }));
}

function Cabinet({
  site,
  setSite,
  gallery,
  setGallery,
  savedSite,
  setSavedSite,
  savedGallery,
  setSavedGallery,
  instagramLive,
  initialVersions,
}: ContentState & { instagramLive: number; initialVersions: Versions }) {
  const { toast, confirm } = useUi();
  const { manage } = useLibrary();
  const { lang, t, pick } = useT();
  const [view, setView] = useState<View>("hero");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [saving, setSaving] = useState(false);
  const [sessionLost, setSessionLost] = useState(false);
  const leaving = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  // Версии файлов, от которых идёт правка: сервер откажет (409), если файл успели изменить.
  const versions = useRef(initialVersions);
  // Непрочитанные заявки и письма во «Входящих» — для значков в меню.
  const [leadsUnread, setLeadsUnread] = useState(0);
  const [mailUnread, setMailUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      // Счётчики — не главное: сбой просто оставляет прежнее значение.
      const [leads, mail] = await Promise.allSettled([listLeads(), mailCounts()]);
      if (!alive) return;
      if (leads.status === "fulfilled") setLeadsUnread(leads.value.unread);
      if (mail.status === "fulfilled") setMailUnread(mail.value.connected ? (mail.value.folders.find((folder) => folder.id === INBOX_ID)?.unread ?? 0) : 0);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), UNREAD_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const siteDirty = useMemo(() => JSON.stringify(site) !== JSON.stringify(savedSite), [site, savedSite]);
  const galleryDirty = useMemo(() => JSON.stringify(gallery) !== JSON.stringify(savedGallery), [gallery, savedGallery]);
  const dirty = siteDirty || galleryDirty;

  const dirtyBlocks = useMemo(() => {
    const set = new Set<BlockId>();
    if (!siteDirty && !galleryDirty) return set;
    for (const block of BLOCKS) {
      if (JSON.stringify(site[block.id]) !== JSON.stringify(savedSite[block.id])) set.add(block.id);
    }
    if (galleryDirty) set.add("gallery");
    return set;
  }, [site, savedSite, siteDirty, galleryDirty]);

  const errorCount = useMemo(() => {
    const counts = new Map<BlockId, number>();
    for (const error of errors) {
      const { blockId } = describePath(error.file, error.path, lang);
      if (blockId) counts.set(blockId, (counts.get(blockId) ?? 0) + 1);
    }
    return counts;
  }, [errors, lang]);

  const siteErrors = useMemo(() => errorsApi(errors, "site", setErrors), [errors]);
  const galleryErrors = useMemo(() => errorsApi(errors, "gallery", setErrors), [errors]);

  useEffect(() => {
    setUnauthorizedHandler(() => setSessionLost(true));
    return () => setUnauthorizedHandler(null);
  }, []);

  // Предупреждение браузера при закрытии вкладки с несохранёнными правками.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  /* Файл на сервере новее черновика: молча перезаписывать нельзя. «Обновить» — загрузить
     свежий контент (правки этой вкладки пропадут), «Отмена» — продолжить без сохранения. */
  const resolveConflict = useCallback(async () => {
    const ok = await confirm({
      title: t("conflict.title"),
      text: (
        <>
          <p>{t("conflict.text")}</p>
          <p>{t("conflict.cancelHint")}</p>
        </>
      ),
      confirmLabel: t("conflict.confirm"),
      danger: true,
    });
    if (!ok) return;
    try {
      const fresh = await loadContent();
      versions.current = fresh.versions;
      setSavedSite(fresh.site);
      setSite(() => fresh.site);
      setSavedGallery(fresh.gallery);
      setGallery(() => fresh.gallery);
      setErrors([]);
      toast("success", t("toast.reloaded"));
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) toast("error", error instanceof Error ? error.message : t("toast.reloadError"));
    }
  }, [confirm, toast, t, setSavedSite, setSite, setSavedGallery, setGallery]);

  const save = useCallback(async () => {
    if (!dirty || saving) return;
    const body: { site?: SiteContent; gallery?: GalleryItem[]; versions: Partial<Versions> } = { versions: {} };
    if (siteDirty) {
      body.site = site;
      body.versions.site = versions.current.site;
    }
    if (galleryDirty) {
      body.gallery = gallery;
      body.versions.gallery = versions.current.gallery;
    }
    setSaving(true);
    let conflict = false;
    try {
      const result = await saveContent(body);
      versions.current = { ...versions.current, ...result.versions };
      if (body.site) setSavedSite(body.site);
      if (body.gallery) setSavedGallery(body.gallery);
      setErrors([]);
      toast("success", t("toast.saved"));
    } catch (error) {
      if (error instanceof ApiError && (error.code === "conflict" || error.status === 409)) {
        conflict = true;
      } else if (error instanceof ApiError && error.errors.length) {
        const parsed = error.errors.map(parseApiError);
        setErrors(parsed);
        toast("error", parsed.length === 1 ? t("toast.saveFailedOne") : t("toast.saveFailedMany", { count: parsed.length }));
        window.requestAnimationFrame(() => document.getElementById("adm-summary")?.focus());
      } else if (!(error instanceof ApiError && error.status === 401)) {
        toast("error", error instanceof Error ? error.message : t("toast.saveError"));
      }
    } finally {
      setSaving(false);
    }
    if (conflict) await resolveConflict();
  }, [dirty, saving, siteDirty, galleryDirty, site, gallery, toast, t, resolveConflict]);

  // Ctrl/Cmd+S — сохранить, а не «сохранить страницу как».
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const open = (next: View) => {
    setView(next);
    window.requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
      document.getElementById("adm-view-title")?.focus({ preventScroll: true });
    });
  };

  const onRestored = async (name: "site" | "gallery") => {
    const fresh = await loadContent();
    // Только версия возвращённого раздела: черновик другого раздела остаётся сверять со старой.
    versions.current = { ...versions.current, [name]: fresh.versions[name] };
    if (name === "site") {
      setSavedSite(fresh.site);
      setSite(() => fresh.site);
    } else {
      setSavedGallery(fresh.gallery);
      setGallery(() => fresh.gallery);
    }
    setErrors((prev) => prev.filter((error) => error.file !== name));
  };

  const signOut = async () => {
    if (dirty) {
      const ok = await confirm({
        title: t("signOut.title"),
        text: <p>{t("signOut.text")}</p>,
        confirmLabel: t("top.signOut"),
        danger: true,
      });
      if (!ok) return;
    }
    leaving.current = true;
    try {
      await logout();
    } catch {
      // Сессия уже могла истечь — на страницу входа всё равно уходим.
    }
    window.location.assign("/admin/login");
  };

  const block = BLOCKS.find((candidate) => candidate.id === view) ?? null;
  const updateBlock: Update<Obj> = (fn) => {
    if (!block) return;
    setSite((prev) => ({ ...prev, [block.id]: fn(prev[block.id] as unknown as Obj) }));
  };

  const groups = [
    { id: "page", title: t("side.page"), blocks: BLOCKS.filter((candidate) => !SHARED_BLOCKS.has(candidate.id)) },
    { id: "shared", title: t("side.shared"), blocks: BLOCKS.filter((candidate) => SHARED_BLOCKS.has(candidate.id)) },
  ];

  return (
    <>
      <header className="adm-top">
        <div className="adm-top__brand">
          <span className="adm-logo" aria-hidden>
            S
          </span>
          <span>
            <strong>Sphagnum Eco</strong>
            <span className="adm-top__sub">{t("brand.sub")}</span>
          </span>
        </div>
        <p className={`adm-status${dirty ? " adm-status--dirty" : ""}`} role="status" aria-live="polite">
          {saving ? t("top.saving") : dirty ? t("top.dirty") : t("top.clean")}
        </p>
        <div className="adm-top__actions">
          {/* Смена языка без перезагрузки: черновик остаётся в памяти страницы. */}
          <LangSwitch onChange={(next) => setErrors((prev) => relocalizeErrors(prev, site, gallery, next))} />
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => void save()} disabled={!dirty || saving} title="Ctrl+S / ⌘S">
            {saving ? t("top.saving") : t("top.save")}
          </button>
          <a className="adm-btn" href={withBase("/")} target="_blank" rel="noopener">
            {t("top.openSite")}
            <span className="adm-sr">{t("top.newTab")}</span>
          </a>
          <button type="button" className="adm-btn" aria-pressed={view === "history"} onClick={() => open(view === "history" ? "hero" : "history")}>
            {t("top.history")}
          </button>
          <button type="button" className="adm-btn adm-btn--quiet" onClick={() => void signOut()}>
            {t("top.signOut")}
          </button>
        </div>
      </header>

      <div className="adm-body">
        <nav className="adm-side" aria-label={t("side.label")}>
          <div className="adm-side__group">
            <p className="adm-side__title">{t("side.inbox")}</p>
            <ul>
              {(
                [
                  { id: "leads", label: t("side.leads"), unread: leadsUnread },
                  { id: "mail", label: t("side.mail"), unread: mailUnread },
                ] as const
              ).map((item) => (
                <li key={item.id}>
                  <button type="button" className="adm-side__item" aria-current={view === item.id ? "page" : undefined} onClick={() => open(item.id)}>
                    <span>{item.label}</span>
                    {item.unread ? (
                      <span className="adm-side__unread" aria-label={t("side.unread", { count: item.unread })}>
                        {item.unread}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {groups.map((group) => (
            <div key={group.id} className="adm-side__group">
              <p className="adm-side__title">{group.title}</p>
              <ul>
                {group.blocks.map((item) => {
                  const count = errorCount.get(item.id) ?? 0;
                  return (
                    <li key={item.id}>
                      <button type="button" className="adm-side__item" aria-current={view === item.id ? "page" : undefined} onClick={() => open(item.id)}>
                        <span>{pick(item.title)}</span>
                        {count ? (
                          <span className="adm-side__errors" aria-label={t("side.errors", { count })}>
                            {count}
                          </span>
                        ) : dirtyBlocks.has(item.id) ? (
                          <span className="adm-side__dot" title={t("top.dirty")}>
                            <span className="adm-sr">{t("side.unsavedSr")}</span>
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="adm-side__group">
            <p className="adm-side__title">{t("side.files")}</p>
            <ul>
              <li>
                <button type="button" className="adm-side__item" onClick={manage}>
                  <span>{t("side.uploads")}</span>
                </button>
              </li>
              <li>
                <button type="button" className="adm-side__item" aria-current={view === "history" ? "page" : undefined} onClick={() => open("history")}>
                  <span>{t("side.history")}</span>
                </button>
              </li>
            </ul>
          </div>
        </nav>

        <main className="adm-main" ref={mainRef}>
          {errors.length ? (
            <div className="adm-summary" id="adm-summary" tabIndex={-1} role="alert">
              <p>
                <strong>{t("summary.notSaved")}</strong> {errors.length === 1 ? t("summary.fixOne") : t("summary.fixMany", { count: errors.length })}
              </p>
              <ul>
                {errors.map((error, index) => {
                  const where = describePath(error.file, error.path, lang);
                  return (
                    <li key={`${error.file}:${error.path}:${index}`}>
                      <button
                        type="button"
                        className="adm-link"
                        onClick={() => {
                          if (where.blockId) setView(where.blockId);
                          revealField(error.file, error.path);
                        }}
                      >
                        {where.label}
                      </button>
                      : {error.message}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {view === "leads" ? (
            <LeadsView onUnreadChange={setLeadsUnread} />
          ) : view === "mail" ? (
            <MailView onUnreadChange={setMailUnread} />
          ) : view === "history" ? (
            <>
              <h1 className="adm-sr" id="adm-view-title" tabIndex={-1}>
                {t("side.history")}
              </h1>
              <HistoryView dirty={{ site: siteDirty, gallery: galleryDirty }} onRestored={onRestored} />
            </>
          ) : block ? (
            <ErrorsContext.Provider value={siteErrors}>
              <section className="adm-panel" aria-labelledby="adm-view-title">
                <header className="adm-panel__head">
                  <h1 id="adm-view-title" tabIndex={-1}>
                    {pick(block.title)}
                    {dirtyBlocks.has(block.id) ? <span className="adm-pill">{t("panel.unsaved")}</span> : null}
                  </h1>
                  <p className="adm-lead">{pick(block.description)}</p>
                </header>
                <FieldsEditor fields={block.fields} value={site[block.id] as unknown as Obj} update={updateBlock} path={block.id} />
              </section>
              {block.id === "gallery" ? (
                <GalleryEditor items={gallery} update={setGallery} errors={galleryErrors} instagramLive={instagramLive} />
              ) : null}
            </ErrorsContext.Provider>
          ) : null}
        </main>
      </div>
      <AnchorDatalist />

      <Dialog open={sessionLost} onClose={() => {}} closable={false} title={t("session.title")} size="small">
        <p className="adm-dialog__text">{t("session.text")}</p>
        <LoginForm
          onSuccess={() => {
            setSessionLost(false);
            toast("success", t("toast.signedInAgain"));
          }}
        />
      </Dialog>
    </>
  );
}
