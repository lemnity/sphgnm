// Запросы кабинета к /api/admin/*. Ответ с ошибкой превращается в ApiError с
// текстом сервера; на 401 срабатывает общий обработчик (окно «войдите снова»).
import type { GalleryItem, SiteContent } from "@/lib/content/schema";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
  get errors(): string[] {
    return Array.isArray(this.data.errors) ? (this.data.errors as string[]) : [];
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function toError(status: number, data: unknown): ApiError {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const message = typeof record.error === "string" ? record.error : `Ошибка сервера (${status})`;
  return new ApiError(status, message, record);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: init.body && typeof init.body === "string" ? { "Content-Type": "application/json", ...init.headers } : init.headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.endsWith("/login")) onUnauthorized?.();
    throw toError(response.status, data);
  }
  return data as T;
}

export type MediaFile = { path: string; kind: "image" | "video" | "other"; size: number; modifiedAt: string };
export type HistoryEntry = { id: string; name: "site" | "gallery"; savedAt: string; size: number };

/** Версии файлов контента: сервер сверяет их при сохранении (409, если файл изменили в другом месте). */
export type Versions = { site: string; gallery: string };

export const loadContent = () => api<{ site: SiteContent; gallery: GalleryItem[]; versions: Versions }>("/api/admin/content");
export const saveContent = (body: { site?: SiteContent; gallery?: GalleryItem[]; versions: Partial<Versions> }) =>
  api<{ ok: true; saved: string[]; versions: Partial<Versions> }>("/api/admin/content", { method: "PUT", body: JSON.stringify(body) });
export const listMedia = () => api<{ files: MediaFile[] }>("/api/admin/media");
export const deleteMedia = (path: string) => api<{ ok: true }>(`/api/admin/media?path=${encodeURIComponent(path)}`, { method: "DELETE" });
export const listHistory = () => api<{ entries: HistoryEntry[] }>("/api/admin/history");
export const restoreHistory = (id: string) =>
  api<{ ok: true; name: "site" | "gallery"; version: string }>("/api/admin/history/restore", { method: "POST", body: JSON.stringify({ id }) });
export const login = (password: string) => api<{ ok: true }>("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
export const logout = () => api<{ ok: true }>("/api/admin/logout", { method: "POST" });

/* Загрузка через XHR: у fetch нет прогресса отправки, а ролик до 150 МБ без
   индикатора выглядит как зависание. */
export function uploadFile(file: File, onProgress?: (share: number) => void): Promise<{ path: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.response as { path: string });
      if (xhr.status === 401) onUnauthorized?.();
      reject(toError(xhr.status, xhr.response));
    };
    xhr.onerror = () => reject(new ApiError(0, "Нет связи с сервером: файл не загружен."));
    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}

export function mediaKind(path: string): "image" | "video" {
  return /\.(mp4|webm)$/i.test(path) ? "video" : "image";
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
}

const DATE_TIME = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}
