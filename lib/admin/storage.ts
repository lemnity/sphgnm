// Файлы админки: контент (content/*.json) с историей версий и загрузки (public/uploads).
// Все функции принимают корень проекта, чтобы тесты работали во временной папке.
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const CONTENT_NAMES = ["site", "gallery"] as const;
export type ContentName = (typeof CONTENT_NAMES)[number];

export const HISTORY_LIMIT = 30;

/** Ошибка с HTTP-статусом: роуты отдают её текст как есть. */
export class StorageError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const contentFile = (root: string, name: ContentName) => path.join(root, "content", `${name}.json`);
const historyDir = (root: string) => path.join(root, "content", ".history");
const uploadsDir = (root: string) => path.join(root, "public", "uploads");

/** Запись через временный файл и rename: читатель никогда не увидит наполовину записанный JSON. */
export async function writeFileAtomic(file: string, data: string | Uint8Array): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await writeFile(tmp, data);
    await rename(tmp, file);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
}

export async function readContent(root: string, name: ContentName): Promise<unknown> {
  const raw = await readFile(contentFile(root, name), "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new StorageError(`content/${name}.json: невалидный JSON — ${(error as Error).message}`, 500);
  }
}

// Двоеточия из ISO-времени недопустимы в именах файлов Windows и неудобны в shell.
const HISTORY_RE = /^(site|gallery)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json$/;

const stamp = (date: Date) => date.toISOString().replace(/[:.]/g, "-");

function parseStamp(value: string): string {
  const [day, time] = value.split("T");
  const [hh, mm, ss, ms] = time.replace("Z", "").split("-");
  return `${day}T${hh}:${mm}:${ss}.${ms}Z`;
}

export type HistoryEntry = { id: string; name: ContentName; savedAt: string; size: number };

// Сохранения идут по очереди: два одновременных PUT не перемешают историю и файл.
const state = globalThis as typeof globalThis & { __sphContentQueue?: Promise<unknown> };

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = (state.__sphContentQueue ?? Promise.resolve()).then(task, task);
  state.__sphContentQueue = run.catch(() => undefined);
  return run;
}

/**
 * Сохраняет контент. Предыдущая версия файла уходит в content/.history/<имя>-<время>.json,
 * хранятся последние HISTORY_LIMIT версий каждого файла. Возвращает id записи истории.
 */
export function writeContent(root: string, name: ContentName, data: unknown, now = new Date()): Promise<string | null> {
  return serialize(async () => {
    const file = contentFile(root, name);
    let historyId: string | null = null;
    let previous: Buffer | null = null;
    try {
      previous = await readFile(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (previous) {
      // Время версии строго больше последней: два сохранения в одну миллисекунду (или часы,
      // ушедшие назад) не затрут версию и не нарушат порядок, по которому режется история.
      const [latest] = (await listHistory(root)).filter((entry) => entry.name === name);
      const time = Math.max(now.getTime(), latest ? Date.parse(latest.savedAt) + 1 : 0);
      historyId = `${name}-${stamp(new Date(time))}.json`;
      await writeFileAtomic(path.join(historyDir(root), historyId), previous);
      await trimHistory(root, name);
    }
    await writeFileAtomic(file, `${JSON.stringify(data, null, 2)}\n`);
    return historyId;
  });
}

async function trimHistory(root: string, name: ContentName) {
  const entries = (await listHistory(root)).filter((entry) => entry.name === name);
  for (const entry of entries.slice(HISTORY_LIMIT)) await rm(path.join(historyDir(root), entry.id), { force: true });
}

/** История версий, новые сверху. */
export async function listHistory(root: string): Promise<HistoryEntry[]> {
  let files: string[];
  try {
    files = await readdir(historyDir(root));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const entries: HistoryEntry[] = [];
  for (const id of files) {
    const match = HISTORY_RE.exec(id);
    if (!match) continue;
    const info = await stat(path.join(historyDir(root), id));
    entries.push({ id, name: match[1] as ContentName, savedAt: parseStamp(match[2]), size: info.size });
  }
  return entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt) || a.name.localeCompare(b.name));
}

/** Читает версию из истории. id проверяется по шаблону — никаких путей извне. */
export async function readHistory(root: string, id: string): Promise<{ name: ContentName; data: unknown }> {
  const match = HISTORY_RE.exec(id);
  if (!match) throw new StorageError("Неизвестная версия", 400);
  let raw: string;
  try {
    raw = await readFile(path.join(historyDir(root), id), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new StorageError("Версия не найдена", 404);
    throw error;
  }
  try {
    return { name: match[1] as ContentName, data: JSON.parse(raw) };
  } catch {
    throw new StorageError(`Версия ${id} повреждена`, 422);
  }
}

/* ---------- Загрузки ---------- */

const MB = 1024 * 1024;

export const UPLOAD_TYPES = {
  jpg: { mime: "image/jpeg", kind: "image", maxBytes: 15 * MB },
  png: { mime: "image/png", kind: "image", maxBytes: 15 * MB },
  webp: { mime: "image/webp", kind: "image", maxBytes: 15 * MB },
  avif: { mime: "image/avif", kind: "image", maxBytes: 15 * MB },
  gif: { mime: "image/gif", kind: "image", maxBytes: 15 * MB },
  mp4: { mime: "video/mp4", kind: "video", maxBytes: 150 * MB },
  webm: { mime: "video/webm", kind: "video", maxBytes: 150 * MB },
} as const;

export type UploadExt = keyof typeof UPLOAD_TYPES;
export const MAX_UPLOAD_BYTES = 150 * MB;

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));

/**
 * Тип файла по первым байтам, а не по имени и Content-Type от браузера: их легко подделать,
 * а SVG/HTML с расширением .jpg браузер потом может исполнить.
 */
export function sniffUploadType(bytes: Uint8Array): UploadExt | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") return "png";
  if (ascii(bytes, 0, 4) === "GIF8") return "gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brands = ascii(bytes, 8, Math.min(bytes.length, 64));
    if (brands.includes("avif") || brands.includes("avis")) return "avif";
    // QuickTime и HEIC тоже «ftyp», но браузеры их толком не показывают.
    if (["qt  ", "heic", "heix", "mif1", "msf1"].includes(ascii(bytes, 8, 12))) return null;
    return "mp4";
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return ascii(bytes, 0, Math.min(bytes.length, 64)).includes("webm") ? "webm" : null;
  }
  return null;
}

export type UploadInput = { name: string; type: string; bytes: Uint8Array };

/** Сохраняет загрузку в public/uploads под случайным именем. Возвращает путь вида "uploads/<id>.<ext>". */
export async function saveUpload(root: string, file: UploadInput): Promise<string> {
  if (/\.svgz?$/i.test(file.name) || /svg/i.test(file.type)) {
    throw new StorageError("SVG загружать нельзя: в нём может быть исполняемый код", 415);
  }
  if (file.bytes.length === 0) throw new StorageError("Пустой файл", 400);
  if (file.bytes.length > MAX_UPLOAD_BYTES) throw new StorageError("Файл больше 150 МБ", 413);
  const ext = sniffUploadType(file.bytes);
  if (!ext) throw new StorageError("Неподдерживаемый тип файла. Можно: jpg, png, webp, avif, gif, mp4, webm", 415);
  const { maxBytes, kind } = UPLOAD_TYPES[ext];
  if (file.bytes.length > maxBytes) {
    throw new StorageError(`Файл слишком большой: ${kind === "image" ? "картинка" : "видео"} — до ${maxBytes / MB} МБ`, 413);
  }
  const name = `${randomBytes(8).toString("hex")}.${ext}`;
  await writeFileAtomic(path.join(uploadsDir(root), name), file.bytes);
  return `uploads/${name}`;
}

const UPLOAD_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*\.[a-z0-9]+$/;

/** "uploads/<имя>" → абсолютный путь. Всё, что выходит за public/uploads, отклоняется. */
export function resolveUploadPath(root: string, relative: string): string {
  const match = /^uploads\/([^/]+)$/.exec(relative);
  if (!match || !UPLOAD_NAME_RE.test(match[1])) throw new StorageError("Недопустимый путь к файлу", 400);
  const dir = uploadsDir(root);
  const full = path.resolve(dir, match[1]);
  if (path.dirname(full) !== dir) throw new StorageError("Недопустимый путь к файлу", 400);
  return full;
}

export function uploadMime(file: string): string {
  const ext = path.extname(file).slice(1).toLowerCase();
  return ext in UPLOAD_TYPES ? UPLOAD_TYPES[ext as UploadExt].mime : "application/octet-stream";
}

export type UploadEntry = { path: string; kind: "image" | "video" | "other"; size: number; modifiedAt: string };

/** Загруженные файлы, новые сверху. */
export async function listUploads(root: string): Promise<UploadEntry[]> {
  let names: string[];
  try {
    names = await readdir(uploadsDir(root));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const entries: UploadEntry[] = [];
  for (const name of names) {
    if (!UPLOAD_NAME_RE.test(name)) continue;
    const info = await stat(path.join(uploadsDir(root), name));
    if (!info.isFile()) continue;
    const ext = path.extname(name).slice(1).toLowerCase();
    const kind = ext in UPLOAD_TYPES ? UPLOAD_TYPES[ext as UploadExt].kind : "other";
    entries.push({ path: `uploads/${name}`, kind, size: info.size, modifiedAt: info.mtime.toISOString() });
  }
  return entries.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export async function deleteUpload(root: string, relative: string): Promise<void> {
  const file = resolveUploadPath(root, relative);
  try {
    await unlink(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new StorageError("Файл не найден", 404);
    throw error;
  }
}

/** Где в контенте встречается путь (чтобы не удалить файл, который ещё на сайте). */
export function findUsages(data: unknown, target: string, at = ""): string[] {
  if (typeof data === "string") return data === target ? [at] : [];
  if (Array.isArray(data)) return data.flatMap((item, index) => findUsages(item, target, `${at}[${index}]`));
  if (data && typeof data === "object") {
    return Object.entries(data).flatMap(([key, value]) => findUsages(value, target, at ? `${at}.${key}` : key));
  }
  return [];
}
