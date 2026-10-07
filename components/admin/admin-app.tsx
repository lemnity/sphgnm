"use client";

// Кабинет: верхняя панель, список блоков, редактор выбранного блока, история.
// Черновик живёт в памяти страницы до «Сохранить»; блоки можно переключать без потерь.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BLOCKS, describePath, parseApiError, splitPath, type BlockId, type FieldError } from "@/lib/admin/fields";
import type { GalleryItem, SiteContent } from "@/lib/content/schema";
import { withBase } from "@/lib/media";
import { ApiError, loadContent, logout, saveContent, setUnauthorizedHandler } from "./api";
import { AnchorDatalist, ErrorsContext, FieldsEditor, fieldId, type ErrorsApi, type Update } from "./fields-editor";
import { GalleryEditor } from "./gallery-editor";
import { HistoryView } from "./history-view";
import { LoginForm } from "./login-form";
import { MediaLibraryProvider, useLibrary } from "./media";
import { AdminUiProvider, Dialog, useUi } from "./ui";
import "./admin.css";

type View = BlockId | "history";
type Obj = Record<string, unknown>;

/* Сервисные блоки — не секции страницы, а общие для всего сайта данные. */
const SHARED_BLOCKS = new Set<BlockId>(["contacts", "nav", "footer", "loader", "meta"]);

export type AdminAppProps = { site: SiteContent; gallery: GalleryItem[]; instagramLive: number };

export function AdminApp(props: AdminAppProps) {
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
    <div className="adm" lang="ru">
      <AdminUiProvider>
        <MediaLibraryProvider isUsedInDraft={usedInDraft}>
          <Cabinet instagramLive={props.instagramLive} {...state} />
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
}: ContentState & { instagramLive: number }) {
  const { toast, confirm } = useUi();
  const { manage } = useLibrary();
  const [view, setView] = useState<View>("hero");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [saving, setSaving] = useState(false);
  const [sessionLost, setSessionLost] = useState(false);
  const leaving = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

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
      const { blockId } = describePath(error.file, error.path);
      if (blockId) counts.set(blockId, (counts.get(blockId) ?? 0) + 1);
    }
    return counts;
  }, [errors]);

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

  const save = useCallback(async () => {
    if (!dirty || saving) return;
    const body: { site?: SiteContent; gallery?: GalleryItem[] } = {};
    if (siteDirty) body.site = site;
    if (galleryDirty) body.gallery = gallery;
    setSaving(true);
    try {
      await saveContent(body);
      if (body.site) setSavedSite(body.site);
      if (body.gallery) setSavedGallery(body.gallery);
      setErrors([]);
      toast("success", "Сохранено. Изменения уже на сайте.");
    } catch (error) {
      if (error instanceof ApiError && error.errors.length) {
        const parsed = error.errors.map(parseApiError);
        setErrors(parsed);
        toast("error", `Не сохранено: ${parsed.length === 1 ? "одна ошибка" : `ошибок — ${parsed.length}`}. Поля отмечены красным.`);
        window.requestAnimationFrame(() => document.getElementById("adm-summary")?.focus());
      } else if (!(error instanceof ApiError && error.status === 401)) {
        toast("error", error instanceof Error ? error.message : "Не удалось сохранить");
      }
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, siteDirty, galleryDirty, site, gallery, toast]);

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
        title: "Выйти без сохранения?",
        text: <p>Несохранённые правки пропадут.</p>,
        confirmLabel: "Выйти",
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

  const block = view === "history" ? null : BLOCKS.find((candidate) => candidate.id === view)!;
  const updateBlock: Update<Obj> = (fn) => {
    if (!block) return;
    setSite((prev) => ({ ...prev, [block.id]: fn(prev[block.id] as unknown as Obj) }));
  };

  const groups = [
    { title: "Страница", blocks: BLOCKS.filter((candidate) => !SHARED_BLOCKS.has(candidate.id)) },
    { title: "Общее", blocks: BLOCKS.filter((candidate) => SHARED_BLOCKS.has(candidate.id)) },
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
            <span className="adm-top__sub">Кабинет</span>
          </span>
        </div>
        <p className={`adm-status${dirty ? " adm-status--dirty" : ""}`} role="status" aria-live="polite">
          {saving ? "Сохраняем…" : dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}
        </p>
        <div className="adm-top__actions">
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => void save()} disabled={!dirty || saving} title="Ctrl+S / ⌘S">
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
          <a className="adm-btn" href={withBase("/")} target="_blank" rel="noopener">
            Открыть сайт<span className="adm-sr"> (в новой вкладке)</span>
          </a>
          <button type="button" className="adm-btn" aria-pressed={view === "history"} onClick={() => open(view === "history" ? "hero" : "history")}>
            История
          </button>
          <button type="button" className="adm-btn adm-btn--quiet" onClick={() => void signOut()}>
            Выйти
          </button>
        </div>
      </header>

      <div className="adm-body">
        <nav className="adm-side" aria-label="Разделы сайта">
          {groups.map((group) => (
            <div key={group.title} className="adm-side__group">
              <p className="adm-side__title">{group.title}</p>
              <ul>
                {group.blocks.map((item) => {
                  const count = errorCount.get(item.id) ?? 0;
                  return (
                    <li key={item.id}>
                      <button type="button" className="adm-side__item" aria-current={view === item.id ? "page" : undefined} onClick={() => open(item.id)}>
                        <span>{item.title}</span>
                        {count ? (
                          <span className="adm-side__errors" aria-label={`ошибок: ${count}`}>
                            {count}
                          </span>
                        ) : dirtyBlocks.has(item.id) ? (
                          <span className="adm-side__dot" title="Есть несохранённые изменения">
                            <span className="adm-sr">есть несохранённые изменения</span>
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
            <p className="adm-side__title">Файлы</p>
            <ul>
              <li>
                <button type="button" className="adm-side__item" onClick={manage}>
                  <span>Загруженные файлы</span>
                </button>
              </li>
              <li>
                <button type="button" className="adm-side__item" aria-current={view === "history" ? "page" : undefined} onClick={() => open("history")}>
                  <span>История версий</span>
                </button>
              </li>
            </ul>
          </div>
        </nav>

        <main className="adm-main" ref={mainRef}>
          {errors.length ? (
            <div className="adm-summary" id="adm-summary" tabIndex={-1} role="alert">
              <p>
                <strong>Не сохранено.</strong> Исправьте {errors.length === 1 ? "ошибку" : `ошибки (${errors.length})`} и нажмите «Сохранить» ещё раз:
              </p>
              <ul>
                {errors.map((error, index) => {
                  const where = describePath(error.file, error.path);
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

          {view === "history" ? (
            <>
              <h1 className="adm-sr" id="adm-view-title" tabIndex={-1}>
                История версий
              </h1>
              <HistoryView dirty={{ site: siteDirty, gallery: galleryDirty }} onRestored={onRestored} />
            </>
          ) : block ? (
            <ErrorsContext.Provider value={siteErrors}>
              <section className="adm-panel" aria-labelledby="adm-view-title">
                <header className="adm-panel__head">
                  <h1 id="adm-view-title" tabIndex={-1}>
                    {block.title}
                    {dirtyBlocks.has(block.id) ? <span className="adm-pill">не сохранено</span> : null}
                  </h1>
                  <p className="adm-lead">{block.description}</p>
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

      <Dialog open={sessionLost} onClose={() => {}} closable={false} title="Сессия истекла" size="small">
        <p className="adm-dialog__text">Войдите снова — несохранённые правки останутся на месте.</p>
        <LoginForm
          onSuccess={() => {
            setSessionLost(false);
            toast("success", "Вы снова вошли. Можно сохранять.");
          }}
        />
      </Dialog>
    </>
  );
}
