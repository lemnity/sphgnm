// Чтение Maildir (раскладка Dovecot) для кабинета. Только чтение: файлы в Maildir
// не создаются, не переименовываются и не удаляются. «Прочитано» хранится отдельно,
// в JSON приложения (mail-state.json), по имени файла без флагов.
import { randomBytes } from "node:crypto";
import { mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_MESSAGE_BYTES, summarize, type MessageSummary } from "./parse.ts";

export const PAGE_SIZE = 50;
/** Сколько байт читаем с начала письма для строки списка. */
const SUMMARY_BYTES = 128 * 1024;

export const INBOX = "INBOX";
/** id папки: INBOX или имя каталога «.Name». */
export const FOLDER_ID_RE = /^(?:INBOX|\.[^/\\\0]{1,200})$/;
/** id письма: имя файла без «:2,флаги». */
export const MESSAGE_ID_RE = /^[A-Za-z0-9_][A-Za-z0-9._,=+-]{0,254}$/;

export type Folder = { id: string; name: string; total: number; unread: number };
export type MessageEntry = { id: string; file: string; flags: string; time: number; size: number };
export type MessageRow = Omit<MessageSummary, "date"> & { date: string; id: string; size: number; read: boolean };
/** Явные отметки кабинета: true — прочитано, false — «не прочитано» поверх флага S. */
export type MailState = Record<string, boolean>;

/** «1700000000.M1P2.host,S=123:2,RS» → { stem, flags: "RS" }. */
export function splitName(name: string): { stem: string; flags: string } {
  const match = /^(.*?)[:!]2,([A-Za-z]*)$/.exec(name);
  return match ? { stem: match[1], flags: match[2] } : { stem: name, flags: "" };
}

/** Модифицированный UTF-7 (имена папок IMAP): «&BBoEPgRABDcEOAQ9BDA-» → «Корзина». */
export function decodeMailboxName(name: string): string {
  return name.replace(/&([A-Za-z0-9+,]*)-/g, (_, b64: string) => {
    if (!b64) return "&";
    const bytes = Buffer.from(b64.replace(/,/g, "/"), "base64");
    let out = "";
    for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return out;
  });
}

const folderDirs = (root: string, id: string) => (id === INBOX ? [root, path.join(root, ".INBOX")] : [path.join(root, id)]);

async function isDir(dir: string): Promise<boolean> {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/** Есть ли Maildir по пути и можно ли его прочитать. */
export async function maildirAvailable(root: string | undefined): Promise<boolean> {
  if (!root) return false;
  try {
    await readdir(root);
    return true;
  } catch {
    return false;
  }
}

/** Письма папки: файлы из new/ и cur/, без скрытых и не-обычных (симлинки пропускаем). */
export async function listEntries(root: string, folderId: string): Promise<MessageEntry[]> {
  const entries: MessageEntry[] = [];
  const seen = new Set<string>();
  for (const dir of folderDirs(root, folderId)) {
    for (const sub of ["new", "cur"]) {
      const full = path.join(dir, sub);
      let names;
      try {
        names = await readdir(full, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const dirent of names) {
        if (!dirent.isFile() || dirent.name.startsWith(".")) continue;
        const { stem, flags } = splitName(dirent.name);
        if (!MESSAGE_ID_RE.test(stem) || seen.has(stem)) continue;
        seen.add(stem);
        const file = path.join(full, dirent.name);
        let info;
        try {
          info = await stat(file);
        } catch {
          continue;
        }
        // Время доставки — из имени файла (секунды), иначе mtime.
        const fromName = /^(\d{9,11})\./.exec(stem);
        const time = fromName ? Number(fromName[1]) * 1000 : info.mtimeMs;
        entries.push({ id: stem, file, flags: sub === "new" ? "" : flags, time, size: info.size });
      }
    }
  }
  return entries.sort((a, b) => b.time - a.time || (a.id < b.id ? 1 : -1));
}

export const isRead = (entry: Pick<MessageEntry, "id" | "flags">, state: MailState) => (entry.id in state ? state[entry.id] : entry.flags.includes("S"));

/** Папки: INBOX первой, остальные — по имени. */
export async function listFolders(root: string, state: MailState = {}): Promise<Folder[]> {
  const folders: Folder[] = [];
  const count = async (id: string, name: string) => {
    const entries = await listEntries(root, id);
    folders.push({ id, name, total: entries.length, unread: entries.filter((entry) => !isRead(entry, state)).length });
  };
  await count(INBOX, INBOX);
  let names: string[] = [];
  try {
    names = (await readdir(root, { withFileTypes: true })).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
  } catch {
    return folders;
  }
  const others = names.filter((name) => name.startsWith(".") && name !== ".INBOX" && name !== "." && name !== ".." && FOLDER_ID_RE.test(name)).sort();
  for (const name of others) {
    if (!(await isDir(path.join(root, name, "cur"))) && !(await isDir(path.join(root, name, "new")))) continue;
    await count(name, decodeMailboxName(name.slice(1)).split(".").join(" / "));
  }
  return folders;
}

/** Начало файла: не больше limit байт. */
export async function readHead(file: string, limit: number): Promise<Buffer> {
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(limit);
    const { bytesRead } = await handle.read(buffer, 0, limit, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function listMessages(
  root: string,
  folderId: string,
  { page = 1, pageSize = PAGE_SIZE, state = {} }: { page?: number; pageSize?: number; state?: MailState } = {},
): Promise<{ total: number; page: number; pages: number; messages: MessageRow[] }> {
  const entries = await listEntries(root, folderId);
  const pages = Math.max(1, Math.ceil(entries.length / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const slice = entries.slice((current - 1) * pageSize, current * pageSize);
  const messages = await Promise.all(
    slice.map(async (entry) => {
      let summary: MessageSummary = { from: "", subject: "", date: null, hasAttachments: false };
      try {
        summary = summarize(await readHead(entry.file, SUMMARY_BYTES));
      } catch {
        // Файл пропал или не читается — строка остаётся без заголовков.
      }
      return { ...summary, date: summary.date ?? new Date(entry.time).toISOString(), id: entry.id, size: entry.size, read: isRead(entry, state) };
    }),
  );
  return { total: entries.length, page: current, pages, messages };
}

/** Письмо по папке и id: путь ищется только среди файлов папки, ввод в путь не подставляется. */
export async function findMessage(root: string, folderId: string, id: string): Promise<MessageEntry | null> {
  if (!FOLDER_ID_RE.test(folderId) || !MESSAGE_ID_RE.test(id)) return null;
  const folders = folderId === INBOX ? [INBOX] : (await listFolders(root)).map((folder) => folder.id);
  if (!folders.includes(folderId)) return null;
  return (await listEntries(root, folderId)).find((entry) => entry.id === id) ?? null;
}

/** Содержимое письма, не больше MAX_MESSAGE_BYTES. */
export const readMessageFile = (entry: MessageEntry) => readHead(entry.file, Math.min(entry.size, MAX_MESSAGE_BYTES) || 1);

/* ---------- отметки «прочитано» (файл приложения, не Maildir) ---------- */

export async function loadMailState(file: string): Promise<MailState> {
  try {
    const data = JSON.parse(await readFile(file, "utf8")) as { read?: unknown };
    const read = data && typeof data.read === "object" && data.read ? (data.read as Record<string, unknown>) : {};
    return Object.fromEntries(Object.entries(read).filter(([key, value]) => MESSAGE_ID_RE.test(key) && typeof value === "boolean")) as MailState;
  } catch {
    return {};
  }
}

// Очередь записей — общая на процесс: роуты Next собираются отдельными модулями.
const shared = globalThis as typeof globalThis & { __sphMailStateQueue?: Promise<unknown> };

/** Отметить письмо; запись через временный файл, по очереди внутри процесса. */
export function setMailRead(file: string, id: string, read: boolean): Promise<void> {
  const run = (shared.__sphMailStateQueue ?? Promise.resolve()).then(async () => {
    const state = await loadMailState(file);
    state[id] = read;
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
    try {
      await writeFile(tmp, `${JSON.stringify({ read: state }, null, 1)}\n`);
      await rename(tmp, file);
    } catch (error) {
      await rm(tmp, { force: true });
      throw error;
    }
  });
  shared.__sphMailStateQueue = run.catch(() => {});
  return run;
}
