// Настройки почты кабинета: путь к Maildir из MAILDIR_PATH и файл отметок «прочитано».
// Сам Maildir только читается (lib/mail/maildir.ts).
import path from "node:path";
import { FOLDER_ID_RE, INBOX, MESSAGE_ID_RE, maildirAvailable } from "../mail/maildir.ts";

type Env = Record<string, string | undefined>;

export const maildirRoot = (env: Env = process.env) => env.MAILDIR_PATH?.trim() || undefined;

/** Отметки «прочитано» — в data/ приложения, рядом с заявками по умолчанию. */
export const mailStateFile = (root = process.cwd()) => path.join(root, "data", "mail-state.json");

/** Путь к Maildir, если он задан и читается; иначе null — «почта не подключена». */
export async function connectedMaildir(env: Env = process.env): Promise<string | null> {
  const root = maildirRoot(env);
  return root && (await maildirAvailable(root)) ? root : null;
}

/** Параметры folder и id из запроса: только допустимые символы, иначе null. */
export function messageRef(params: URLSearchParams): { folder: string; id: string } | null {
  const folder = params.get("folder") || INBOX;
  const id = params.get("id") ?? "";
  return FOLDER_ID_RE.test(folder) && MESSAGE_ID_RE.test(id) ? { folder, id } : null;
}

/** «attachment; filename=…» с ASCII-запасным именем и UTF-8 по RFC 5987. */
export function attachmentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "attachment";
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
