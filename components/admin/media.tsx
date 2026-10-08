"use client";

// Медиатека (окно со списком загруженных файлов) и поле выбора файла с превью.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { describeUsage } from "@/lib/admin/fields";
import { withBase } from "@/lib/media";
import type { MessageKey } from "@/lib/admin/i18n";
import { ApiError, deleteMedia, listMedia, mediaKind, uploadFile, type MediaFile } from "./api";
import { useT } from "./i18n";
import { Dialog, useUi } from "./ui";

export type Accept = "image" | "video" | "any";

export const ACCEPT_ATTR: Record<Accept, string> = {
  image: "image/jpeg,image/png,image/webp,image/avif,image/gif",
  video: "video/mp4,video/webm",
  any: "image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm",
};

const KIND_LABEL: Record<Accept, MessageKey> = { image: "media.images", video: "media.videos", any: "media.all" };

type LibraryRequest = { accept: Accept; resolve: (path: string | null) => void } | { accept: "any"; resolve: null };

const LibraryContext = createContext<{ pick: (accept: Accept) => Promise<string | null>; manage: () => void } | null>(null);

export function useLibrary() {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("useLibrary вне MediaLibraryProvider");
  return value;
}

/** Загрузка одного файла с прогрессом и понятной ошибкой. */
export function useUpload() {
  const { toast } = useUi();
  const { t } = useT();
  const [progress, setProgress] = useState<number | null>(null);
  const upload = useCallback(
    async (file: File): Promise<string | null> => {
      setProgress(0);
      try {
        const { path } = await uploadFile(file, setProgress);
        return path;
      } catch (error) {
        toast("error", `${file.name}: ${error instanceof Error ? error.message : t("media.notUploaded")}`);
        return null;
      } finally {
        setProgress(null);
      }
    },
    [toast, t],
  );
  return { upload, progress };
}

/**
 * isUsedInDraft — путь стоит в несохранённых правках. Сервер про них не знает и
 * разрешил бы удалить файл, на который уже ссылается черновик.
 */
export function MediaLibraryProvider({ children, isUsedInDraft }: { children: ReactNode; isUsedInDraft: (path: string) => boolean }) {
  const [request, setRequest] = useState<LibraryRequest | null>(null);
  const { t } = useT();

  const pick = useCallback((accept: Accept) => new Promise<string | null>((resolve) => setRequest({ accept, resolve })), []);
  const manage = useCallback(() => setRequest({ accept: "any", resolve: null }), []);

  const close = (path: string | null) => {
    request?.resolve?.(path);
    setRequest(null);
  };

  return (
    <LibraryContext.Provider value={{ pick, manage }}>
      {children}
      <Dialog open={request !== null} onClose={() => close(null)} title={request?.resolve ? t("media.pickTitle") : t("side.uploads")} size="large">
        {request ? (
          <Library accept={request.accept} onSelect={request.resolve ? (path) => close(path) : null} isUsedInDraft={isUsedInDraft} />
        ) : null}
      </Dialog>
    </LibraryContext.Provider>
  );
}

function Library({
  accept,
  onSelect,
  isUsedInDraft,
}: {
  accept: Accept;
  onSelect: ((path: string) => void) | null;
  isUsedInDraft: (path: string) => boolean;
}) {
  const { toast, confirm } = useUi();
  const { lang, t, date, size } = useT();
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [filter, setFilter] = useState<Accept>(accept);
  const [failed, setFailed] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const { upload, progress } = useUpload();
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setFiles((await listMedia()).files);
      setFailed(null);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : t("media.listFailed"));
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onFiles = async (list: FileList | null) => {
    for (const file of Array.from(list ?? [])) {
      const path = await upload(file);
      if (path) setFresh(path);
    }
    await refresh();
  };

  const remove = async (file: MediaFile) => {
    const name = file.path.split("/").pop();
    if (isUsedInDraft(file.path)) {
      toast("error", t("media.usedInDraft", { name: name ?? "" }));
      return;
    }
    const ok = await confirm({
      title: t("media.confirmTitle"),
      text: <p>{t("media.confirmText", { name: name ?? "" })}</p>,
      confirmLabel: t("media.delete"),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMedia(file.path);
      toast("success", t("media.deleted"));
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "fileInUse") {
        const usedIn = Array.isArray(error.data.usedIn) ? (error.data.usedIn as string[]) : [];
        toast("error", t("media.inUse"), usedIn.map((entry) => describeUsage(entry, lang)));
      } else toast("error", error instanceof Error ? error.message : t("media.deleteFailed"));
    }
  };

  const shown = (files ?? []).filter((file) => filter === "any" || file.kind === filter);
  const filters: Accept[] = accept === "any" ? ["any", "image", "video"] : [accept];

  return (
    <div className="adm-library">
      <div className="adm-library__bar">
        {filters.length > 1 ? (
          <div className="adm-segmented" role="group" aria-label={t("media.filter")}>
            {filters.map((kind) => (
              <button key={kind} type="button" aria-pressed={filter === kind} onClick={() => setFilter(kind)}>
                {t(KIND_LABEL[kind])}
              </button>
            ))}
          </div>
        ) : (
          <p className="adm-muted">{accept === "image" ? t("media.onlyImages") : t("media.onlyVideos")}</p>
        )}
        <div className="adm-library__upload">
          {progress !== null ? <Progress value={progress} /> : null}
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => input.current?.click()} disabled={progress !== null}>
            {t("media.uploadFiles")}
          </button>
          <input
            ref={input}
            type="file"
            hidden
            multiple
            accept={ACCEPT_ATTR[accept]}
            onChange={(event) => {
              void onFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </div>
      <p className="adm-hint">{t("media.hint")}</p>
      {failed ? <p className="adm-error-text">{failed}</p> : null}
      {files === null && !failed ? <p className="adm-muted">{t("media.loading")}</p> : null}
      {files !== null && shown.length === 0 ? <p className="adm-empty">{t("media.empty")}</p> : null}
      <ul className="adm-library__grid">
        {shown.map((file) => {
          const name = file.path.split("/").pop();
          return (
            <li key={file.path} className={`adm-tile${fresh === file.path ? " adm-tile--fresh" : ""}`}>
              <MediaPreview path={file.path} />
              <div className="adm-tile__meta">
                <span className="adm-tile__name" title={name}>
                  {name}
                </span>
                <span className="adm-muted">
                  {size(file.size)} · {date(file.modifiedAt)}
                </span>
              </div>
              <div className="adm-tile__actions">
                {onSelect ? (
                  <button type="button" className="adm-btn adm-btn--primary adm-btn--small" onClick={() => onSelect(file.path)}>
                    {t("media.select")}
                  </button>
                ) : null}
                <button type="button" className="adm-btn adm-btn--small adm-btn--ghost-danger" onClick={() => void remove(file)} aria-label={t("media.deleteAria", { name: name ?? "" })}>
                  {t("media.delete")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  const { t } = useT();
  const percent = Math.round(value * 100);
  return (
    <span className="adm-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t("media.progress")}>
      <span style={{ width: `${percent}%` }} />
      <em>{percent}%</em>
    </span>
  );
}

/** Превью файла из public. Ролик без постера показывает первый кадр. */
export function MediaPreview({ path, poster, className = "adm-preview" }: { path: string; poster?: string; className?: string }) {
  const { t } = useT();
  if (!path) return <div className={`${className} ${className}--empty`}>{t("media.noFile")}</div>;
  if (mediaKind(path) === "video") {
    return (
      <div className={className}>
        <video src={withBase(path)} poster={poster ? withBase(poster) : undefined} muted playsInline preload="metadata" />
        <span className="adm-badge">{t("gallery.video")}</span>
      </div>
    );
  }
  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={withBase(path)} alt="" loading="lazy" />
    </div>
  );
}

/**
 * Поле файла: превью, «Загрузить/Заменить», «Выбрать из загруженных», при optional — «Убрать».
 * Значение — путь от public ("uploads/…").
 */
export function MediaPathControl({
  value,
  onChange,
  accept,
  optional = false,
  label,
  describedBy,
}: {
  value: string;
  onChange: (path: string) => void;
  accept: Exclude<Accept, "any">;
  optional?: boolean;
  label: string;
  describedBy?: string;
}) {
  const { upload, progress } = useUpload();
  const { pick } = useLibrary();
  const { toast } = useUi();
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="adm-media" aria-describedby={describedBy}>
      <MediaPreview path={value} />
      <div className="adm-media__side">
        <code className="adm-media__path">{value || t("media.notChosen")}</code>
        <div className="adm-media__buttons">
          <button type="button" className="adm-btn adm-btn--small" onClick={() => input.current?.click()} disabled={progress !== null}>
            {value ? t("media.replace") : t("media.upload")}
            <span className="adm-sr"> — {label}</span>
          </button>
          <button
            type="button"
            className="adm-btn adm-btn--small"
            onClick={async () => {
              const path = await pick(accept);
              if (path) onChange(path);
            }}
          >
            {t("media.fromLibrary")}
            <span className="adm-sr"> — {label}</span>
          </button>
          {optional && value ? (
            <button type="button" className="adm-btn adm-btn--small adm-btn--ghost-danger" onClick={() => onChange("")}>
              {t("media.remove")}
              <span className="adm-sr"> — {label}</span>
            </button>
          ) : null}
        </div>
        {progress !== null ? <Progress value={progress} /> : null}
        <input
          ref={input}
          type="file"
          hidden
          accept={ACCEPT_ATTR[accept]}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const path = await upload(file);
            if (!path) return;
            if (mediaKind(path) !== accept) {
              // Сервер принял файл, но сюда нужен другой тип (ролик вместо картинки).
              toast("error", accept === "image" ? t("media.needImage") : t("media.needVideo"));
              return;
            }
            onChange(path);
          }}
        />
      </div>
    </div>
  );
}
