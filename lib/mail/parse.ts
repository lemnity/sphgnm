// Разбор писем MIME без зависимостей: заголовки, RFC 2047/2231, multipart, base64/QP, кодировки.
// Только чтение: модуль ничего не пишет и не знает о файловой системе.

/** Сколько байт письма читаем максимум. */
export const MAX_MESSAGE_BYTES = 20 * 1024 * 1024;
/** Сколько символов текста и HTML отдаём в кабинет. */
export const MAX_TEXT_CHARS = 512 * 1024;
export const MAX_HTML_CHARS = 1536 * 1024;
const MAX_DEPTH = 12;
const MAX_PARTS = 500;

export type Headers = Map<string, string[]>;

export type MimePart = {
  headers: Headers;
  /** type/subtype в нижнем регистре. */
  type: string;
  params: Record<string, string>;
  disposition: string;
  dispositionParams: Record<string, string>;
  /** Тело части как есть (латиница-1: байт = символ), до снятия transfer-encoding. */
  raw: string;
  children: MimePart[];
};

export type Attachment = { index: number; name: string; type: string; size: number };

export type ParsedMessage = {
  from: string;
  to: string;
  cc: string;
  subject: string;
  /** ISO, если Date разобрался. */
  date: string | null;
  messageId: string;
  text: string;
  /** HTML как в письме — перед отдачей его чистит sanitize.ts. */
  html: string;
  attachments: Attachment[];
  /** Текст или HTML обрезаны по лимиту. */
  truncated: boolean;
};

/* ---------- байты и кодировки ---------- */

const toBytes = (binary: string) => Buffer.from(binary, "latin1");

/** Метка кодировки → TextDecoder; неизвестная — null. */
function decoderFor(charset: string, fatal = false): TextDecoder | null {
  const label = charset.trim().toLowerCase().replace(/^"|"$/g, "").replace(/\*.*$/, "");
  const aliases: Record<string, string> = { "us-ascii": "utf-8", ascii: "utf-8", utf8: "utf-8", cp1251: "windows-1251", "win-1251": "windows-1251", latin1: "iso-8859-1" };
  try {
    return new TextDecoder(aliases[label] ?? label, { fatal });
  } catch {
    return null;
  }
}

/** Байты в строку: заданная кодировка, иначе UTF-8, иначе windows-1252 (никогда не бросает). */
export function decodeBytes(bytes: Uint8Array, charset?: string): string {
  if (charset) {
    const decoder = decoderFor(charset);
    if (decoder) {
      // us-ascii часто врёт: внутри бывает UTF-8. Строгая попытка, затем обычная.
      if (decoder.encoding === "utf-8") {
        try {
          return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          return new TextDecoder("windows-1252").decode(bytes);
        }
      }
      return decoder.decode(bytes);
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function decodeQuotedPrintable(binary: string): string {
  return binary.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

export function decodeBase64(binary: string): string {
  return Buffer.from(binary.replace(/[^A-Za-z0-9+/]/g, ""), "base64").toString("latin1");
}

/** Снимает Content-Transfer-Encoding; результат — снова «байтовая» строка. */
export function decodeTransfer(binary: string, encoding: string): string {
  const cte = encoding.trim().toLowerCase();
  if (cte === "base64") return decodeBase64(binary);
  if (cte === "quoted-printable") return decodeQuotedPrintable(binary);
  return binary;
}

/* ---------- заголовки ---------- */

/** Сырые заголовки (латиница-1) → карта имя → значения; строки продолжения склеены. */
export function parseHeaders(head: string): Headers {
  const headers: Headers = new Map();
  const unfolded = head.replace(/\r?\n(?=[ \t])/g, "");
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    if (!/^[\x21-\x39\x3b-\x7e]+$/.test(name)) continue;
    const value = line.slice(colon + 1).trim();
    const list = headers.get(name);
    if (list) list.push(value);
    else headers.set(name, [value]);
  }
  return headers;
}

/** Делит письмо на заголовки и тело по первой пустой строке. */
export function splitHeadBody(binary: string): { head: string; body: string } {
  const match = /\r?\n\r?\n/.exec(binary);
  if (!match) return { head: binary, body: "" };
  // Письмо без заголовков (начинается с пустой строки).
  if (match.index === 0) return { head: "", body: binary.slice(match[0].length) };
  return { head: binary.slice(0, match.index), body: binary.slice(match.index + match[0].length) };
}

const first = (headers: Headers, name: string) => headers.get(name)?.[0] ?? "";

/** Восьмибитный заголовок без кодирования: пробуем UTF-8, иначе windows-1252. */
const rawHeaderText = (value: string) => (/[\x80-\xff]/.test(value) ? decodeBytes(toBytes(value)) : value);

/** RFC 2047: =?charset?B|Q?…?=; пробелы между соседними словами убираются. */
export function decodeWords(value: string): string {
  const text = rawHeaderText(value);
  const word = /=\?([^?\s]+)\?([BbQq])\?([^?\s]*)\?=/g;
  let out = "";
  let last = 0;
  let previousWasWord = false;
  for (let match = word.exec(text); match; match = word.exec(text)) {
    const between = text.slice(last, match.index);
    if (!(previousWasWord && /^\s*$/.test(between))) out += between;
    const [, charset, mode, payload] = match;
    const binary = mode.toUpperCase() === "B" ? decodeBase64(payload) : decodeQuotedPrintable(payload.replace(/_/g, " "));
    out += decodeBytes(toBytes(binary), charset);
    last = match.index + match[0].length;
    previousWasWord = true;
  }
  return out + text.slice(last);
}

/**
 * Значение с параметрами: «text/plain; charset="utf-8"; name*=UTF-8''%D0%B0».
 * RFC 2231 (name*, name*0*, …) склеивается и раскодируется; имена параметров — в нижнем регистре.
 */
export function parseParams(value: string): { value: string; params: Record<string, string> } {
  const tokens: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (quoted) {
      if (char === "\\" && i + 1 < value.length) current += value[++i];
      else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ";") {
      tokens.push(current);
      current = "";
    } else current += char;
  }
  tokens.push(current);

  const main = (tokens.shift() ?? "").trim().toLowerCase();
  const plain: Record<string, string> = {};
  const extended = new Map<string, { index: number; encoded: boolean; text: string }[]>();
  for (const token of tokens) {
    const eq = token.indexOf("=");
    if (eq <= 0) continue;
    const key = token.slice(0, eq).trim().toLowerCase();
    const raw = token.slice(eq + 1).trim();
    const match = /^([^*]+)\*(?:(\d+)\*?)?$/.exec(key);
    if (!match) {
      plain[key] = raw;
      continue;
    }
    const [, base, index] = match;
    const list = extended.get(base) ?? [];
    list.push({ index: index === undefined ? 0 : Number(index), encoded: key.endsWith("*"), text: raw });
    extended.set(base, list);
  }

  const params: Record<string, string> = {};
  for (const [key, raw] of Object.entries(plain)) params[key] = decodeWords(raw);
  for (const [base, segments] of extended) {
    segments.sort((a, b) => a.index - b.index);
    let charset = "utf-8";
    let binary = "";
    segments.forEach((segment, position) => {
      let text = segment.text;
      if (segment.encoded && position === 0) {
        const parts = /^([^']*)'[^']*'(.*)$/.exec(text);
        if (parts) {
          charset = parts[1] || "utf-8";
          text = parts[2];
        }
      }
      binary += segment.encoded ? text.replace(/%([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))) : text;
    });
    params[base] = decodeBytes(toBytes(binary), charset);
  }
  return { value: main, params };
}

/* ---------- части ---------- */

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Делит тело multipart по границе. Нет ни одной границы — null (битое письмо). */
export function splitMultipart(body: string, boundary: string): string[] | null {
  const delimiter = new RegExp(`(?:^|\\r?\\n)--${escapeRegExp(boundary)}(--)?[ \\t]*(?=\\r?\\n|$)`, "g");
  const parts: string[] = [];
  let start = -1;
  for (let match = delimiter.exec(body); match; match = delimiter.exec(body)) {
    if (start >= 0) parts.push(body.slice(start, match.index));
    if (match[1]) return parts; // закрывающая граница
    start = match.index + match[0].length;
    // Перевод строки после границы относится к ней.
    if (body.startsWith("\r\n", start)) start += 2;
    else if (body[start] === "\n") start += 1;
  }
  if (start < 0) return null;
  // Закрывающей границы нет — берём остаток до конца.
  parts.push(body.slice(start));
  return parts;
}

export function parsePart(binary: string, depth = 0, counter = { parts: 0 }, defaultType = "text/plain"): MimePart {
  counter.parts++;
  const { head, body } = splitHeadBody(binary);
  const headers = parseHeaders(head);
  const contentType = parseParams(first(headers, "content-type") || defaultType);
  const disposition = parseParams(first(headers, "content-disposition"));
  let type = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(contentType.value) ? contentType.value : "text/plain";
  const part: MimePart = {
    headers,
    type,
    params: contentType.params,
    disposition: disposition.value,
    dispositionParams: disposition.params,
    raw: body,
    children: [],
  };
  if (type.startsWith("multipart/")) {
    const boundary = contentType.params.boundary;
    const chunks = boundary ? splitMultipart(body, boundary) : null;
    if (!chunks || depth >= MAX_DEPTH) {
      // Битая граница: показываем тело как текст, а не падаем.
      type = "text/plain";
      part.type = type;
      return part;
    }
    const childDefault = type === "multipart/digest" ? "message/rfc822" : "text/plain";
    for (const chunk of chunks) {
      if (counter.parts >= MAX_PARTS) break;
      part.children.push(parsePart(chunk, depth + 1, counter, childDefault));
    }
  }
  return part;
}

/** Тело части без transfer-encoding (байтовая строка). */
export const partBytes = (part: MimePart) => decodeTransfer(part.raw, first(part.headers, "content-transfer-encoding"));

export function partText(part: MimePart): string {
  return decodeBytes(toBytes(partBytes(part)), part.params.charset);
}

const EXTENSIONS: Record<string, string> = {
  "text/plain": "txt",
  "text/html": "html",
  "text/calendar": "ics",
  "message/rfc822": "eml",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

/** Имя вложения без путей и управляющих символов. */
export function safeFileName(name: string, fallback: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 180);
  return clean && clean !== "." && clean !== ".." ? clean : fallback;
}

type Walked = { text: MimePart | null; html: MimePart | null; attachments: MimePart[] };

function walk(part: MimePart, found: Walked) {
  if (part.type.startsWith("multipart/")) {
    for (const child of part.children) walk(child, found);
    return;
  }
  const name = part.dispositionParams.filename ?? part.params.name;
  const isAttachment = part.disposition === "attachment" || Boolean(name);
  if (!isAttachment && part.type === "text/plain" && !found.text) found.text = part;
  else if (!isAttachment && part.type === "text/html" && !found.html) found.html = part;
  else found.attachments.push(part);
}

function attachmentName(part: MimePart, index: number): string {
  const ext = EXTENSIONS[part.type] ?? "bin";
  return safeFileName(part.dispositionParams.filename ?? part.params.name ?? "", `part-${index + 1}.${ext}`);
}

/** Письмо в «байтовой» строке (latin1) или Buffer. */
const asBinary = (input: string | Uint8Array) => (typeof input === "string" ? input : Buffer.from(input.buffer, input.byteOffset, input.byteLength).toString("latin1"));

function cap(value: string, max: number): { value: string; cut: boolean } {
  return value.length > max ? { value: value.slice(0, max), cut: true } : { value, cut: false };
}

function isoDate(value: string): string | null {
  if (!value) return null;
  const time = Date.parse(value.replace(/\s*\([^)]*\)\s*$/, ""));
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/** Грубый текст из HTML — для превью, когда в письме нет text/plain. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head|title)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Math.min(Number(code), 0x10ffff)))
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseMessage(input: string | Uint8Array): ParsedMessage {
  const root = parsePart(asBinary(input).slice(0, MAX_MESSAGE_BYTES));
  const found: Walked = { text: null, html: null, attachments: [] };
  walk(root, found);
  const html = cap(found.html ? partText(found.html) : "", MAX_HTML_CHARS);
  const text = cap(found.text ? partText(found.text) : html.value ? htmlToText(html.value) : "", MAX_TEXT_CHARS);
  const header = (name: string) => decodeWords(first(root.headers, name)).replace(/\s+/g, " ").trim();
  return {
    from: header("from"),
    to: header("to"),
    cc: header("cc"),
    subject: header("subject"),
    date: isoDate(first(root.headers, "date")),
    messageId: header("message-id"),
    text: text.value,
    html: html.value,
    attachments: found.attachments.map((part, index) => ({ index, name: attachmentName(part, index), type: part.type, size: partBytes(part).length })),
    truncated: text.cut || html.cut,
  };
}

/** Вложение по номеру из parseMessage().attachments. */
export function getAttachment(input: string | Uint8Array, index: number): { name: string; type: string; data: Buffer } | null {
  const root = parsePart(asBinary(input).slice(0, MAX_MESSAGE_BYTES));
  const found: Walked = { text: null, html: null, attachments: [] };
  walk(root, found);
  const part = found.attachments[index];
  if (!part) return null;
  return { name: attachmentName(part, index), type: part.type, data: toBytes(partBytes(part)) };
}

export type MessageSummary = { from: string; subject: string; date: string | null; hasAttachments: boolean };

/** Сводка для списка — по началу письма, без разбора всего тела. */
export function summarize(input: string | Uint8Array): MessageSummary {
  const binary = asBinary(input);
  const { head } = splitHeadBody(binary);
  const headers = parseHeaders(head);
  const header = (name: string) => decodeWords(first(headers, name)).replace(/\s+/g, " ").trim();
  const hasAttachments =
    /^content-disposition:[ \t]*attachment/im.test(binary) ||
    (/^multipart\/mixed/i.test(first(headers, "content-type")) && /(?:file)?name\*?(?:0\*?)?\s*=/i.test(binary.slice(head.length)));
  return { from: header("from"), subject: header("subject"), date: isoDate(first(headers, "date")), hasAttachments };
}

/** «"Anna" <a@b.c>» → { name: "Anna", address: "a@b.c" }. */
export function splitAddress(value: string): { name: string; address: string } {
  const match = /^\s*"?(.*?)"?\s*<([^<>]+)>\s*(?:,.*)?$/.exec(value);
  if (match) return { name: match[1].trim(), address: match[2].trim() };
  return { name: "", address: value.split(",")[0]?.trim() ?? "" };
}
