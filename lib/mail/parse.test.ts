import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  decodeBytes,
  decodeQuotedPrintable,
  decodeWords,
  getAttachment,
  htmlToText,
  MAX_HTML_CHARS,
  parseHeaders,
  parseMessage,
  parseParams,
  safeFileName,
  splitAddress,
  splitMultipart,
  summarize,
} from "./parse.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

test("RFC 2047: UTF-8 B, windows-1251 Q, KOI8-R, ISO-8859-1; пробел между словами убирается", () => {
  assert.equal(decodeWords("=?UTF-8?B?0J/RgNC40LLQtdGC?="), "Привет");
  assert.equal(decodeWords("=?windows-1251?Q?=CF=F0=E8=E2=E5=F2_=EC=E8=F0?="), "Привет мир");
  assert.equal(decodeWords("=?koi8-r?B?9MXT1A==?="), "Тест");
  assert.equal(decodeWords("=?ISO-8859-1?Q?Andr=E9?="), "André");
  assert.equal(decodeWords("=?UTF-8?B?0JA=?= =?UTF-8?B?0JE=?="), "АБ");
  assert.equal(decodeWords("Re: =?UTF-8?Q?=D0=90?= and text"), "Re: А and text");
  // Неизвестная кодировка и битое слово — без исключений.
  assert.equal(typeof decodeWords("=?x-unknown?B?////?="), "string");
  assert.equal(decodeWords("=?UTF-8?B?not-closed"), "=?UTF-8?B?not-closed");
});

test("заголовки: склейка продолжений, регистр имён, повторы", () => {
  const headers = parseHeaders("Subject: one\r\n two\r\nX-A: 1\r\nx-a: 2\r\nbroken line\r\n");
  assert.deepEqual(headers.get("subject"), ["one two"]);
  assert.deepEqual(headers.get("x-a"), ["1", "2"]);
  assert.equal(headers.size, 2);
});

test("параметры: кавычки, RFC 2231 с продолжениями", () => {
  assert.deepEqual(parseParams('text/plain; charset="utf-8"; format=flowed'), { value: "text/plain", params: { charset: "utf-8", format: "flowed" } });
  assert.equal(parseParams("attachment; filename*=UTF-8''%D0%A4%D0%B0%D0%B9%D0%BB.pdf").params.filename, "Файл.pdf");
  assert.equal(parseParams("attachment; filename*0*=UTF-8''%D0%A4; filename*1=ile.txt").params.filename, "File.txt".replace("F", "Ф"));
  assert.equal(parseParams('a; name="q\\"x"').params.name, 'q"x');
});

test("quoted-printable: мягкие переносы и байты", () => {
  assert.equal(decodeQuotedPrintable("soft =\r\nbreak =3D ok"), "soft break = ok");
  assert.equal(decodeBytes(Buffer.from(decodeQuotedPrintable("Caf=C3=A9"), "latin1"), "utf-8"), "Café");
});

test("кодировки: нет charset — UTF-8, иначе windows-1252; us-ascii с UTF-8 внутри", () => {
  assert.equal(decodeBytes(Buffer.from("Привет", "utf8")), "Привет");
  assert.equal(decodeBytes(Buffer.from([0x43, 0x61, 0x66, 0xe9])), "Café");
  assert.equal(decodeBytes(Buffer.from("Привет", "utf8"), "us-ascii"), "Привет");
  assert.equal(decodeBytes(Buffer.from([0xcf, 0xf0]), "windows-1251"), "Пр");
  assert.equal(decodeBytes(Buffer.from("ok"), "x-nonsense"), "ok");
});

test("письмо с закодированными заголовками и base64-телом", () => {
  const message = parseMessage(fixture("encoded-headers.eml"));
  assert.equal(message.subject, "Заявка на субстрат — крыша");
  assert.equal(message.from, "Анна Петрова <anna@example.com>");
  assert.equal(message.to, "sales@sphagnum.ae");
  assert.equal(message.date, "2026-10-10T08:05:00.000Z");
  assert.equal(message.text, "Здравствуйте!\nНужно 500 м² субстрата.\n");
  assert.equal(message.html, "");
  assert.deepEqual(message.attachments, []);
  assert.deepEqual(splitAddress(message.from), { name: "Анна Петрова", address: "anna@example.com" });
});

test("multipart/alternative: текст из QP с мягким переносом, HTML отдельно", () => {
  const message = parseMessage(fixture("alternative.eml"));
  assert.equal(message.subject, "Тест alternative");
  assert.equal(message.text, "This line is long and has a soft break right here and continues. Café — ok.\r\n".replace(/\r\n$/, ""));
  assert.match(message.html, /<p id="hello">Hello <b>roof<\/b> team<\/p>/);
  assert.deepEqual(message.attachments, []);
  assert.equal(summarize(fixture("alternative.eml")).hasAttachments, false);
});

test("вложенный multipart/mixed: текст, HTML и вложения по имени, размеру, типу", () => {
  const raw = fixture("nested-mixed.eml");
  const message = parseMessage(raw);
  assert.equal(message.text.trim(), "Please see the drawings.");
  assert.equal(message.html.trim(), "<p>Please see the <i>drawings</i>.</p>");
  assert.equal(message.cc, "office@example.org");
  assert.deepEqual(
    message.attachments.map(({ name, type }) => [name, type]),
    [
      ["Чертеж.pdf", "application/pdf"],
      ["фото.png", "image/png"],
      ["passwd", "application/octet-stream"],
    ],
  );
  assert.equal(message.attachments[0].size, Buffer.byteLength("%PDF-1.4\n% fake pdf for tests\n"));
  const pdf = getAttachment(raw, 0);
  assert.equal(pdf?.data.toString("latin1"), "%PDF-1.4\n% fake pdf for tests\n");
  assert.equal(getAttachment(raw, 1)?.data.subarray(0, 4).toString("latin1"), "\x89PNG");
  assert.equal(getAttachment(raw, 3), null);
  const summary = summarize(raw);
  assert.equal(summary.hasAttachments, true);
  assert.equal(summary.subject, "Drawings attached");
});

test("без charset: 8-битный UTF-8 в заголовках и теле; latin-1 с charset", () => {
  const message = parseMessage(fixture("no-charset.eml"));
  assert.equal(message.subject, "Без кодировки");
  assert.equal(message.from, "Олег <oleg@example.com>");
  assert.equal(message.text.trim(), "Привет, это тело без charset.");
  const latin = parseMessage(fixture("latin1.eml"));
  assert.equal(latin.subject, "Résumé");
  assert.equal(latin.from, "André <andre@example.fr>");
  assert.equal(latin.text.trim(), "Café crème");
  assert.equal(latin.date, null);
});

test("битые границы: без исключений, текст не теряется", () => {
  const lost = parseMessage(fixture("malformed-boundary.eml"));
  assert.match(lost.text, /lost text/);
  const unclosed = parseMessage(fixture("malformed-unclosed.eml"));
  assert.match(unclosed.text, /first part/);
  assert.equal(unclosed.attachments.at(-1)?.name, "report.pdf");
  const noParam = parseMessage(fixture("malformed-noparam.eml"));
  assert.match(noParam.text, /just text/);
  assert.equal(splitMultipart("no delimiters", "x"), null);
  // Мусор и пустота.
  for (const junk of ["", "\r\n\r\n", "garbage without headers", "Content-Type: multipart/mixed; boundary=\"\"\r\n\r\n--\r\n", "Content-Type: /\r\n\r\nx"]) {
    assert.equal(typeof parseMessage(junk).text, "string");
  }
});

test("глубокая вложенность и лимит размера HTML", () => {
  let nested = "x";
  for (let depth = 0; depth < 40; depth++) nested = `Content-Type: multipart/mixed; boundary=b${depth}\r\n\r\n--b${depth}\r\n${nested}\r\n--b${depth}--\r\n`;
  assert.equal(typeof parseMessage(nested).text, "string");
  const big = `Content-Type: text/html\r\n\r\n${"<p>a</p>".repeat(MAX_HTML_CHARS / 4)}`;
  const parsed = parseMessage(big);
  assert.equal(parsed.html.length, MAX_HTML_CHARS);
  assert.equal(parsed.truncated, true);
  // Нет text/plain — превью из HTML.
  assert.match(parsed.text, /^a\na\n/);
});

test("имя файла вложения: без путей и управляющих символов", () => {
  assert.equal(safeFileName("../../etc/passwd", "f"), "passwd");
  assert.equal(safeFileName("C:\\Users\\x\\a.pdf", "f"), "a.pdf");
  assert.equal(safeFileName("..", "fallback.bin"), "fallback.bin");
  assert.equal(safeFileName('a"\r\nb.txt', "f"), "ab.txt");
});

test("htmlToText", () => {
  assert.equal(htmlToText("<style>p{}</style><p>One&nbsp;&amp; two</p><br>three<script>x</script>"), "One & two\n\nthree");
});

test("htmlToText: символы, у которых меняется длина в нижнем регистре, не сдвигают теги", () => {
  assert.equal(htmlToText("<p>İİİ<title>t</title>after</p><head>h</head>"), "İİİafter");
  assert.equal(htmlToText("<P>ẞİ<SCRIPT>x</SCRIPT>ok</P>"), "ẞİok");
  assert.equal(htmlToText("İ".repeat(50) + "<style>secret</style>visible"), "İ".repeat(50) + "visible");
});
