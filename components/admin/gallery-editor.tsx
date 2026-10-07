"use client";

// Элементы галереи (content/gallery.json): сетка карточек, загрузка пачкой,
// подписи, даты, постеры роликов, порядок.
import { useRef, useState } from "react";
import type { GalleryItem } from "@/lib/content/schema";
import { withBase } from "@/lib/media";
import { mediaKind } from "./api";
import { FieldErrors, fieldId, type ErrorsApi, type Update } from "./fields-editor";
import { ACCEPT_ATTR, MediaPathControl, MediaPreview, Progress, useUpload } from "./media";
import { useUi } from "./ui";

function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function newId(taken: Set<string>): string {
  let id = "";
  do id = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  while (taken.has(id));
  return id;
}

/** Подпись по умолчанию — имя файла без расширения и подчёркиваний. */
function titleFromFile(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

export function GalleryEditor({
  items,
  update,
  errors,
  instagramLive,
}: {
  items: GalleryItem[];
  update: Update<GalleryItem[]>;
  errors: ErrorsApi;
  instagramLive: number;
}) {
  const { confirm } = useUi();
  const { upload, progress } = useUpload();
  const [batch, setBatch] = useState<{ index: number; total: number; name: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const onFiles = async (files: File[]) => {
    let added = 0;
    for (const [index, file] of files.entries()) {
      setBatch({ index: index + 1, total: files.length, name: file.name });
      const path = await upload(file);
      if (!path) continue;
      added += 1;
      update((prev) => {
        const item: GalleryItem = {
          id: newId(new Set(prev.map((entry) => entry.id))),
          type: mediaKind(path),
          src: path,
          title: titleFromFile(file.name),
          date: today(),
        };
        // Новые — в начало: на сайте галерея идёт от свежих к старым.
        return [item, ...prev];
      });
    }
    setBatch(null);
    if (added) window.requestAnimationFrame(() => document.getElementById(`${fieldId("gallery[0]")}-title`)?.focus());
  };

  const setField = (index: number, key: "title" | "date" | "poster", value: string) => {
    errors.clear(`gallery[${index}].${key}`);
    update((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (key === "poster" && !value) {
          // Без постера ключ убираем совсем, как у остальных роликов без обложки.
          const { poster: _drop, ...rest } = item;
          return rest;
        }
        return { ...item, [key]: value };
      }),
    );
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    update((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    const atEdge = target === 0 || target === items.length - 1;
    const button = atEdge ? (delta < 0 ? "next" : "prev") : delta < 0 ? "prev" : "next";
    window.requestAnimationFrame(() => document.getElementById(`${fieldId(`gallery[${target}]`)}-${button}`)?.focus());
  };

  const remove = async (index: number) => {
    const item = items[index];
    const ok = await confirm({
      title: "Убрать из галереи?",
      text: (
        <p>
          «{item.title || "Без подписи"}» пропадёт с сайта после сохранения. Сам файл останется в загруженных — его можно удалить там.
        </p>
      ),
      confirmLabel: "Убрать",
      danger: true,
    });
    if (!ok) return;
    errors.clear("gallery");
    update((prev) => prev.filter((_, i) => i !== index));
    window.requestAnimationFrame(() => document.getElementById("gallery-upload")?.focus());
  };

  const listErrors = errors.at("gallery");

  return (
    <section className="adm-gallery" aria-labelledby="gallery-items-title">
      <div className="adm-gallery__head">
        <div>
          <h3 id="gallery-items-title">
            Элементы галереи <span className="adm-count">{items.length}</span>
          </h3>
          <p className="adm-hint">Можно выбрать сразу несколько файлов: картинки и ролики mp4/webm. Новые появляются первыми.</p>
        </div>
        <div className="adm-gallery__upload">
          {batch ? (
            <span className="adm-muted" aria-live="polite">
              {batch.index} из {batch.total}: {batch.name}
            </span>
          ) : null}
          {progress !== null ? <Progress value={progress} /> : null}
          <button id="gallery-upload" type="button" className="adm-btn adm-btn--primary" onClick={() => input.current?.click()} disabled={batch !== null}>
            Загрузить фото и видео
          </button>
          <input
            ref={input}
            type="file"
            hidden
            multiple
            accept={ACCEPT_ATTR.any}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length) void onFiles(files);
            }}
          />
        </div>
      </div>

      {instagramLive > 0 ? (
        <p className="adm-note">
          Сейчас на сайте показываются живые посты Instagram ({instagramLive}). Эти элементы появятся, когда лента Instagram будет пустой.
        </p>
      ) : null}
      <FieldErrors id="gallery-err" errors={listErrors} />
      {items.length === 0 ? <p className="adm-empty">В галерее пока ничего нет.</p> : null}

      <ol className="adm-gallery__grid">
        {items.map((item, index) => {
          const at = `gallery[${index}]`;
          const id = fieldId(at);
          const number = `Элемент № ${index + 1}`;
          const own = (key: string) => errors.at(`${at}.${key}`);
          const itemErrors = [...errors.at(at), ...own("src"), ...own("id"), ...own("type")];
          const hasErrors = itemErrors.length + own("title").length + own("date").length + own("poster").length > 0;
          return (
            <li key={item.id} className={`adm-gcard${hasErrors ? " adm-gcard--error" : ""}`} data-item={id}>
              {item.type === "video" && item.poster ? (
                <div className="adm-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={withBase(item.poster)} alt="" loading="lazy" />
                  <span className="adm-badge">Видео</span>
                </div>
              ) : (
                <MediaPreview path={item.src} />
              )}
              <div className="adm-gcard__body">
                <div className="adm-gcard__top">
                  <span className="adm-gcard__num">№ {index + 1}</span>
                  <div className="adm-list__controls">
                    <button type="button" id={`${id}-prev`} className="adm-iconbtn" aria-label={`${number}: раньше`} title="Раньше" disabled={index === 0} onClick={() => move(index, -1)}>
                      ←
                    </button>
                    <button
                      type="button"
                      id={`${id}-next`}
                      className="adm-iconbtn"
                      aria-label={`${number}: позже`}
                      title="Позже"
                      disabled={index === items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      →
                    </button>
                    <button type="button" className="adm-iconbtn adm-iconbtn--danger" aria-label={`${number}: убрать из галереи`} title="Убрать" onClick={() => void remove(index)}>
                      ✕
                    </button>
                  </div>
                </div>
                <FieldErrors id={`${id}-err`} errors={itemErrors} />
                <div className={`adm-field${own("title").length ? " adm-field--error" : ""}`}>
                  <label className="adm-label adm-label--small" htmlFor={`${id}-title`}>
                    Подпись
                  </label>
                  <textarea id={`${id}-title`} className="adm-input adm-textarea" rows={2} value={item.title} onChange={(event) => setField(index, "title", event.target.value)} />
                  <FieldErrors id={`${id}-title-err`} errors={own("title")} />
                </div>
                <div className={`adm-field${own("date").length ? " adm-field--error" : ""}`}>
                  <label className="adm-label adm-label--small" htmlFor={`${id}-date`}>
                    Дата
                  </label>
                  <input id={`${id}-date`} className="adm-input" type="date" value={item.date} onChange={(event) => setField(index, "date", event.target.value)} />
                  <FieldErrors id={`${id}-date-err`} errors={own("date")} />
                </div>
                {item.type === "video" ? (
                  <div className={`adm-field adm-field--poster${own("poster").length ? " adm-field--error" : ""}`}>
                    <span className="adm-label adm-label--small">Постер (обложка ролика)</span>
                    <MediaPathControl value={item.poster ?? ""} onChange={(path) => setField(index, "poster", path)} accept="image" optional label={`постер, ${number}`} />
                    {!item.poster ? <p className="adm-hint">Без постера покажется первый кадр ролика.</p> : null}
                    <FieldErrors id={`${id}-poster-err`} errors={own("poster")} />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
