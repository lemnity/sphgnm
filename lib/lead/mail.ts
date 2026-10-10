// Сборка письма MIME и отправка через локальный sendmail (Postfix). Без зависимостей.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { isEmail } from "./validate.ts";

export class HeaderInjectionError extends Error {
  constructor(header: string) {
    super(`Недопустимый перевод строки в заголовке ${header}`);
    this.name = "HeaderInjectionError";
  }
}

export type Address = { name?: string; address: string };

export type MailMessage = {
  from: Address;
  to: Address[];
  replyTo?: Address;
  subject: string;
  text: string;
  html: string;
  /** Дополнительные заголовки, например Auto-Submitted. */
  headers?: Record<string, string>;
  date?: Date;
  messageId?: string;
};

// sendmail ждёт строки в локальном формате (LF); CRLF в провод ставит сам Postfix.
const EOL = "\n";

/** Любой CR/LF/NUL в значении заголовка — попытка дописать свой заголовок. */
export function assertHeaderSafe(header: string, value: string): void {
  if (/[\r\n\0]/.test(value)) throw new HeaderInjectionError(header);
}

/** «Имя <addr@host>» или просто «addr@host». */
export function parseAddress(input: string): Address {
  assertHeaderSafe("address", input);
  const match = /^\s*(?:"?([^"<>]*?)"?\s*<([^<>\s]+)>|([^<>\s]+))\s*$/.exec(input);
  const address = match?.[2] ?? match?.[3] ?? "";
  if (!isEmail(address)) throw new Error(`Некорректный адрес: ${input}`);
  const name = match?.[1]?.trim();
  return name ? { name, address } : { address };
}

/** Список через запятую; пустые элементы пропускаются. */
export function parseAddressList(input: string): Address[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseAddress);
}

const isPlainAscii = (value: string) => /^[\x20-\x7E]*$/.test(value);

/** RFC 2047: UTF-8 base64-слова не длиннее 75 символов, символы не разрываем. */
export function encodeWords(value: string): string {
  const words: string[] = [];
  let chunk = "";
  for (const char of value) {
    if (Buffer.byteLength(chunk + char) > 45) {
      words.push(chunk);
      chunk = "";
    }
    chunk += char;
  }
  if (chunk) words.push(chunk);
  return words.map((word) => `=?UTF-8?B?${Buffer.from(word, "utf8").toString("base64")}?=`).join(`${EOL} `);
}

function encodeText(header: string, value: string): string {
  assertHeaderSafe(header, value);
  return isPlainAscii(value) && value.length <= 900 ? value : encodeWords(value);
}

export function formatAddress(header: string, { name, address }: Address): string {
  assertHeaderSafe(header, address);
  if (!isEmail(address)) throw new Error(`Некорректный адрес в ${header}`);
  if (!name) return address;
  assertHeaderSafe(header, name);
  const display = isPlainAscii(name) ? `"${name.replace(/(["\\])/g, "\\$1")}"` : encodeWords(name);
  return `${display} <${address}>`;
}

/** Дата по RFC 5322: «Sat, 10 Oct 2026 10:00:00 +0000». */
export function formatDate(date: Date): string {
  return date.toUTCString().replace(/GMT$/, "+0000");
}

/** base64 строками по 76 символов. */
function base64Lines(text: string): string {
  const encoded = Buffer.from(text.replace(/\r\n?/g, "\n").replace(/\n/g, "\r\n"), "utf8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join(EOL) ?? "";
}

export const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1);

export function createMessageId(from: Address): string {
  return `<${Date.now().toString(36)}.${randomBytes(9).toString("hex")}@${domainOf(from.address)}>`;
}

/** Письмо multipart/alternative: текст и HTML, оба в base64. */
export function buildMessage(message: MailMessage): string {
  if (!message.to.length) throw new Error("Нет получателей");
  const boundary = `=_sph_${randomBytes(12).toString("hex")}`;
  const headers: [string, string][] = [
    ["From", formatAddress("From", message.from)],
    ["To", message.to.map((to) => formatAddress("To", to)).join(", ")],
  ];
  if (message.replyTo) headers.push(["Reply-To", formatAddress("Reply-To", message.replyTo)]);
  headers.push(
    ["Subject", encodeText("Subject", message.subject)],
    ["Date", formatDate(message.date ?? new Date())],
    ["Message-ID", message.messageId ?? createMessageId(message.from)],
    ["MIME-Version", "1.0"],
  );
  for (const [name, value] of Object.entries(message.headers ?? {})) {
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(name)) throw new HeaderInjectionError(name);
    headers.push([name, encodeText(name, value)]);
  }
  headers.push(["Content-Type", `multipart/alternative; boundary="${boundary}"`]);
  for (const [name, value] of headers) assertHeaderSafe(name, value.replaceAll(`${EOL} `, " "));

  const part = (type: string, body: string) =>
    [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", base64Lines(body)].join(EOL);

  return [
    ...headers.map(([name, value]) => `${name}: ${value}`),
    "",
    "This is a multi-part message in MIME format.",
    part("text/plain", message.text),
    part("text/html", message.html),
    `--${boundary}--`,
    "",
  ].join(EOL);
}

export type SendRaw = (raw: string, envelopeFrom: string) => Promise<void>;

export class SendmailError extends Error {
  /** Код выхода или системная ошибка (ENOENT) — без адресов и текста письма. */
  readonly reason: string;
  constructor(message: string, reason: string) {
    super(message);
    this.name = "SendmailError";
    this.reason = reason;
  }
}

/**
 * Передаёт готовое письмо в `sendmail -t -i -f <from>`: получатели берутся из заголовков,
 * точка в строке не обрывает письмо. Без shell — аргументы не интерпретируются.
 */
export function sendmailTransport(path = process.env.SENDMAIL_PATH || "/usr/sbin/sendmail", timeoutMs = 12_000): SendRaw {
  return (raw, envelopeFrom) =>
    new Promise<void>((resolve, reject) => {
      if (!isEmail(envelopeFrom)) return reject(new SendmailError("Некорректный адрес отправителя", "badFrom"));
      const child = spawn(path, ["-t", "-i", "-f", envelopeFrom], { stdio: ["pipe", "ignore", "pipe"], shell: false });
      let settled = false;
      const done = (error?: SendmailError) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        done(new SendmailError("sendmail не ответил вовремя", "timeout"));
      }, timeoutMs);
      // stderr читаем, чтобы процесс не встал на полном буфере; в логи его не пишем — там адреса.
      child.stderr.resume();
      child.on("error", (error: NodeJS.ErrnoException) => done(new SendmailError("sendmail не запустился", error.code ?? "spawn")));
      child.on("close", (code, signal) => {
        if (code === 0) done();
        else done(new SendmailError("sendmail завершился с ошибкой", signal ? `signal ${signal}` : `exit ${code}`));
      });
      child.stdin.on("error", () => {}); // EPIPE при упавшем sendmail — итог скажет close
      child.stdin.end(raw, "utf8");
    });
}
