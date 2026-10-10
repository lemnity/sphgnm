// Чтение Maildir (раскладка Dovecot) для кабинета. Только чтение: файлы в Maildir
// не создаются, не переименовываются и не удаляются. «Прочитано» хранится отдельно,
// в JSON приложения (mail-state.json), по имени файла без флагов.
import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { displayText, MAX_MESSAGE_BYTES, summarize, type MessageSummary } from "./parse.ts";

export const PAGE_SIZE = 50;
/** Сколько байт читаем с начала письма для строки списка. */
const SUMMARY_BYTES = 128 * 1024;
/** Сколько живёт список файлов папки в памяти (сбрасывается раньше, если изменились new/ или cur/). */
const LIST_CACHE_MS = 15_000;

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
  const at = Math.max(name.lastIndexOf(":2,"), name.lastIndexOf("!2,"));
  if (at < 0) return { stem: name, flags: "" };
  const flags = name.slice(at + 3);
  return /^[A-Za-z]*$/.test(flags) ? { stem: name.slice(0, at), flags } : { stem: name, flags: "" };
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

/**
 * Полнота обхода: false, если что-то не прочиталось по иной причине, чем «нет такого»
 * (EACCES, Dovecot пересобирает папку…). По неполному обходу нельзя чистить отметки.
 */
type Scan = { complete: boolean };

const absent = (error: unknown) => ["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "");

/** Настоящий каталог (симлинк не считается: из Maildir наружу не ходим). */
async function isRealDir(dir: string, scan?: Scan): Promise<boolean> {
  try {
    return (await lstat(dir)).isDirectory();
  } catch (error) {
    if (scan && !absent(error)) scan.complete = false;
    return false;
  }
}

/** Каталоги new/ и cur/ папки, только настоящие. Корень Maildir сам может быть симлинком — его задаёт админ. */
async function folderSubdirs(root: string, folderId: string, scan?: Scan): Promise<string[]> {
  const bases = folderId === INBOX ? [root, path.join(root, ".INBOX")] : [path.join(root, folderId)];
  const out: string[] = [];
  for (const [index, base] of bases.entries()) {
    if (!(index === 0 && folderId === INBOX) && !(await isRealDir(base, scan))) continue;
    for (const sub of ["new", "cur"]) if (await isRealDir(path.join(base, sub), scan)) out.push(path.join(base, sub));
  }
  return out;
}

type Cached = { at: number; signature: string; entries: MessageEntry[] };
const shared = globalThis as typeof globalThis & { __sphMailStateQueue?: Promise<unknown>; __sphMaildirCache?: Map<string, Cached> };
const listCache = () => (shared.__sphMaildirCache ??= new Map());

/** Сбросить кэш списков (тесты). */
export const clearMaildirCache = () => listCache().clear();

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

/**
 * Письма папки: файлы из new/ и cur/, без скрытых и не-обычных (симлинки пропускаем).
 * Список кэшируется на LIST_CACHE_MS; новое письмо или смена флагов меняют mtime каталога — кэш сбрасывается.
 */
export async function listEntries(root: string, folderId: string): Promise<MessageEntry[]> {
  return (await scanEntries(root, folderId)).entries;
}

/** То же, что listEntries, плюс признак, что все каталоги папки прочитались. */
export async function scanEntries(root: string, folderId: string): Promise<{ entries: MessageEntry[]; complete: boolean }> {
  const scan: Scan = { complete: true };
  const dirs = await folderSubdirs(root, folderId, scan);
  // mtime меняется с письмами, ctime — ещё и со сменой прав каталога.
  const times = await Promise.all(
    dirs.map(async (dir) => {
      const info = await lstat(dir).catch(() => null);
      return info ? `${info.mtimeMs}/${info.ctimeMs}` : "-";
    }),
  );
  const signature = dirs.map((dir, index) => `${dir}@${times[index]}`).join("|");
  const key = `${root}\0${folderId}`;
  const cached = listCache().get(key);
  if (scan.complete && cached && cached.signature === signature && Date.now() - cached.at < LIST_CACHE_MS) return { entries: cached.entries, complete: true };

  const entries: MessageEntry[] = [];
  const seen = new Set<string>();
  for (const full of dirs) {
    const sub = path.basename(full);
    let names;
    try {
      names = await readdir(full, { withFileTypes: true });
    } catch (error) {
      if (!absent(error)) scan.complete = false;
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
        info = await lstat(file);
      } catch {
        continue;
      }
      if (!info.isFile()) continue;
      // Время доставки — из имени файла (секунды), иначе mtime.
      const fromName = /^(\d{9,11})\./.exec(stem);
      const time = fromName ? Number(fromName[1]) * 1000 : info.mtimeMs;
      entries.push({ id: stem, file, flags: sub === "new" ? "" : flags, time, size: info.size });
    }
  }
  entries.sort((a, b) => b.time - a.time || (a.id < b.id ? 1 : -1));
  // Неполный список не кэшируем: следующий запрос попробует прочитать заново.
  if (scan.complete) {
    if (listCache().size > 200) listCache().clear();
    listCache().set(key, { at: Date.now(), signature, entries });
  }
  return { entries, complete: scan.complete };
}

export const isRead = (entry: Pick<MessageEntry, "id" | "flags">, state: MailState) =>
  Object.hasOwn(state, entry.id) ? state[entry.id] === true : entry.flags.includes("S");

/** Пустые отметки без прототипа: id письма вроде «__proto__» — просто ключ. */
export const emptyMailState = (): MailState => Object.create(null) as MailState;

/** Каталоги папок кроме INBOX: «.Имя», настоящие, с new/ или cur/. */
async function otherFolders(root: string, scan?: Scan): Promise<string[]> {
  let names: string[] = [];
  try {
    names = (await readdir(root, { withFileTypes: true })).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
  } catch {
    if (scan) scan.complete = false;
    return [];
  }
  const out: string[] = [];
  for (const name of names.filter(isFolderName).sort()) {
    if ((await isRealDir(path.join(root, name, "cur"), scan)) || (await isRealDir(path.join(root, name, "new"), scan))) out.push(name);
  }
  return out;
}

const isFolderName = (name: string) => name.startsWith(".") && name !== ".INBOX" && name !== "." && name !== ".." && FOLDER_ID_RE.test(name);

/** Папки: INBOX первой, остальные — по имени. */
export async function listFolders(root: string, state: MailState = emptyMailState()): Promise<Folder[]> {
  const folders: Folder[] = [];
  const count = async (id: string, name: string) => {
    const entries = await listEntries(root, id);
    folders.push({ id, name, total: entries.length, unread: entries.filter((entry) => !isRead(entry, state)).length });
  };
  await count(INBOX, INBOX);
  for (const name of await otherFolders(root)) await count(name, displayText(decodeMailboxName(name.slice(1)).split(".").join(" / ")));
  return folders;
}

/**
 * id всех писем во всех папках — для чистки отметок «прочитано».
 * null, если хоть что-то не прочиталось: временная ошибка доступа не должна стереть отметки папки.
 */
export async function allMessageIds(root: string): Promise<Set<string> | null> {
  const scan: Scan = { complete: true };
  const ids = new Set<string>();
  for (const folder of [INBOX, ...(await otherFolders(root, scan))]) {
    const result = await scanEntries(root, folder);
    if (!result.complete) return null;
    for (const entry of result.entries) ids.add(entry.id);
  }
  return scan.complete ? ids : null;
}

/** Начало файла: не больше limit байт. */
export async function readHead(file: string, limit: number): Promise<Buffer> {
  // O_NOFOLLOW: если файл подменили симлинком после проверки, открытие откажет.
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!(await handle.stat()).isFile()) throw Object.assign(new Error("not a regular file"), { code: "EINVAL" });
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
  { page = 1, pageSize = PAGE_SIZE, state = emptyMailState() }: { page?: number; pageSize?: number; state?: MailState } = {},
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
  // Только запрошенная папка: INBOX или «.Имя», которая есть среди каталогов корня.
  if (folderId !== INBOX) {
    if (!isFolderName(folderId)) return null;
    const names = await readdir(root).catch(() => [] as string[]);
    if (!names.includes(folderId) || !(await isRealDir(path.join(root, folderId)))) return null;
  }
  return (await listEntries(root, folderId)).find((entry) => entry.id === id) ?? null;
}

/** Содержимое письма, не больше MAX_MESSAGE_BYTES. */
export const readMessageFile = (entry: MessageEntry) => readHead(entry.file, Math.min(entry.size, MAX_MESSAGE_BYTES) || 1);

/* ---------- отметки «прочитано» (файл приложения, не Maildir) ---------- */

export async function loadMailState(file: string): Promise<MailState> {
  const state = emptyMailState();
  try {
    const data = JSON.parse(await readFile(file, "utf8")) as { read?: unknown };
    const read = data && typeof data.read === "object" && data.read ? (data.read as Record<string, unknown>) : {};
    for (const [key, value] of Object.entries(read)) if (MESSAGE_ID_RE.test(key) && typeof value === "boolean") state[key] = value;
  } catch {
    // Нет файла или он битый — все отметки по флагам Maildir.
  }
  return state;
}

/**
 * Отметить письмо; запись через временный файл, по очереди внутри процесса.
 * existing — id писем, которые ещё есть: отметки исчезнувших писем при записи удаляются.
 */
export function setMailRead(file: string, id: string, read: boolean, existing?: Set<string> | null): Promise<void> {
  const run = (shared.__sphMailStateQueue ?? Promise.resolve()).then(async () => {
    const state = await loadMailState(file);
    state[id] = read;
    if (existing) for (const key of Object.keys(state)) if (key !== id && !existing.has(key)) delete state[key];
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
