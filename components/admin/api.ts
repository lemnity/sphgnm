// Запросы кабинета к /api/admin/*. Ответ с ошибкой превращается в ApiError с
// текстом сервера; на 401 срабатывает общий обработчик (окно «войдите снова»).
import { LANG_HEADER, translate, type AdminLang } from "@/lib/admin/i18n";
import type { GalleryItem, SiteContent } from "@/lib/content/schema";
import type { StoredLead } from "@/lib/lead/store";
import type { Folder, MessageRow } from "@/lib/mail/maildir";
import type { Attachment } from "@/lib/mail/parse";

/* Язык открытого интерфейса: уходит в заголовке, чтобы сервер ответил на нём же.
   Ставит AdminLangProvider. */
let apiLang: AdminLang = "ru";
export function setApiLang(lang: AdminLang) {
  apiLang = lang;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
  /** Машинный код ошибки от сервера ("validation", "conflict", …). */
  get code(): string | undefined {
    return typeof this.data.code === "string" ? this.data.code : undefined;
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
  const message = typeof record.error === "string" ? record.error : translate(apiLang, "net.serverError", { status });
  return new ApiError(status, message, record);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        [LANG_HEADER]: apiLang,
        ...(init.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, translate(apiLang, "net.offline"));
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
/* ---------- входящие: заявки и почта (только чтение) ---------- */

export type { StoredLead, Folder, MessageRow, Attachment };
/** id папки «Входящие» в Maildir (как в lib/mail/maildir.ts; тот модуль серверный). */
export const INBOX_ID = "INBOX";
export type MailList =
  | { connected: false }
  | { connected: true; folders: Folder[]; folder: string; page: number; pages: number; total: number; messages: MessageRow[] };
export type MailMessage = {
  id: string;
  folder: string;
  size: number;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  text: string;
  html: string;
  attachments: Attachment[];
  truncated: boolean;
};

export const listLeads = () => api<{ leads: StoredLead[]; unread: number }>("/api/admin/leads");
export const setLeadRead = (id: string, read: boolean) =>
  api<{ lead: StoredLead }>(`/api/admin/leads/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ read }) });
export const deleteLead = (id: string) => api<{ ok: true }>(`/api/admin/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
export const LEADS_CSV_URL = "/api/admin/leads/csv";

const mailQuery = (params: Record<string, string | number>) => new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString();
export const listMail = (folder: string, page: number) => api<MailList>(`/api/admin/mail?${mailQuery({ folder, page })}`);
export const mailCounts = () => api<{ connected: false } | { connected: true; folders: Folder[] }>("/api/admin/mail?counts=1");
export const openMail = (folder: string, id: string) => api<{ message: MailMessage }>(`/api/admin/mail/message?${mailQuery({ folder, id })}`);
export const setMailRead = (folder: string, id: string, read: boolean) =>
  api<{ ok: true }>(`/api/admin/mail/message?${mailQuery({ folder, id })}`, { method: "PATCH", body: JSON.stringify({ read }) });
export const attachmentUrl = (folder: string, id: string, index: number) => `/api/admin/mail/attachment?${mailQuery({ folder, id, index })}`;

export const login = (password: string) => api<{ ok: true }>("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
export const logout = () => api<{ ok: true }>("/api/admin/logout", { method: "POST" });

/* Загрузка через XHR: у fetch нет прогресса отправки, а ролик до 150 МБ без
   индикатора выглядит как зависание. */
export function uploadFile(file: File, onProgress?: (share: number) => void): Promise<{ path: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");
    xhr.setRequestHeader(LANG_HEADER, apiLang);
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.response as { path: string });
      if (xhr.status === 401) onUnauthorized?.();
      reject(toError(xhr.status, xhr.response));
    };
    xhr.onerror = () => reject(new ApiError(0, translate(apiLang, "net.uploadOffline")));
    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}

export function mediaKind(path: string): "image" | "video" {
  return /\.(mp4|webm)$/i.test(path) ? "video" : "image";
}
