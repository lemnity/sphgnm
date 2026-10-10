import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { HeaderInjectionError, buildMessage, encodeWords, formatAddress, parseAddress, parseAddressList, sendmailTransport, type MailMessage } from "./mail.ts";

/** Разбор письма для проверок: заголовки (со склейкой переносов) и части multipart. */
function parseMime(raw: string) {
  const [head, ...rest] = raw.split("\n\n");
  const headers = new Map<string, string>();
  for (const line of head.replace(/\n /g, " ").split("\n")) {
    const at = line.indexOf(":");
    headers.set(line.slice(0, at).toLowerCase(), line.slice(at + 1).trim());
  }
  const boundary = /boundary="([^"]+)"/.exec(headers.get("content-type") ?? "")?.[1] ?? "";
  const body = rest.join("\n\n");
  const parts = body
    .split(`--${boundary}`)
    .slice(1, -1)
    .map((chunk) => {
      const [partHead, partBody] = chunk.replace(/^\n/, "").split("\n\n");
      return { head: partHead, content: Buffer.from(partBody.replace(/\s+/g, ""), "base64").toString("utf8") };
    });
  return { headers, parts, boundary, closed: body.includes(`--${boundary}--`) };
}

const decodeWords = (value: string) =>
  value.replace(/=\?UTF-8\?B\?([^?]+)\?=\s*/g, (_, data: string) => Buffer.from(data, "base64").toString("utf8")).trim();

const message: MailMessage = {
  from: parseAddress("Sphagnum Eco <noreply@sphagnum.ae>"),
  to: parseAddressList("team@sphagnum.ae, Отдел продаж <sales@sphagnum.ae>"),
  replyTo: { name: 'Jane "J" Doe', address: "jane@example.com" },
  subject: "Заявка № 261011-AB2C: Анна — Green roof / podium, очень длинная тема письма для переноса",
  text: "Привет\nмир",
  html: "<p>Привет</p>",
  date: new Date("2026-10-10T20:30:00Z"),
};

test("структура multipart/alternative", () => {
  const raw = buildMessage(message);
  const mime = parseMime(raw);
  assert.equal(mime.headers.get("from"), '"Sphagnum Eco" <noreply@sphagnum.ae>');
  assert.equal(mime.headers.get("reply-to"), '"Jane \\"J\\" Doe" <jane@example.com>');
  assert.equal(mime.headers.get("date"), "Sat, 10 Oct 2026 20:30:00 +0000");
  assert.match(mime.headers.get("message-id")!, /^<[^<>@\s]+@sphagnum\.ae>$/);
  assert.equal(mime.headers.get("mime-version"), "1.0");
  assert.match(mime.headers.get("content-type")!, /^multipart\/alternative; boundary="/);
  assert.equal(mime.parts.length, 2);
  assert.match(mime.parts[0].head, /Content-Type: text\/plain; charset=UTF-8\nContent-Transfer-Encoding: base64/);
  assert.match(mime.parts[1].head, /Content-Type: text\/html; charset=UTF-8/);
  assert.equal(mime.parts[0].content, "Привет\r\nмир");
  assert.equal(mime.parts[1].content, "<p>Привет</p>");
  assert.ok(mime.closed);
  // Тело — только ASCII, строки не длиннее 76 символов.
  assert.ok(raw.split("\n").every((line) => line.length <= 998 && /^[\x20-\x7E]*$/.test(line)));
});

test("тема и имена — RFC 2047", () => {
  const mime = parseMime(buildMessage(message));
  const subject = mime.headers.get("subject")!;
  assert.match(subject, /^=\?UTF-8\?B\?/);
  assert.equal(decodeWords(subject), message.subject);
  // Каждое закодированное слово — не длиннее 75 символов (RFC 2047).
  assert.ok(buildMessage(message).match(/=\?UTF-8\?B\?[^?]+\?=/g)!.every((word) => word.length <= 75));
  const to = mime.headers.get("to")!;
  assert.match(to, /^team@sphagnum\.ae, =\?UTF-8\?B\?.+\?= <sales@sphagnum\.ae>$/);
  assert.equal(decodeWords(to.split(", ")[1].replace(/ <.*$/, "")), "Отдел продаж");
  assert.equal(encodeWords("ascii").startsWith("=?UTF-8?B?"), true);
  assert.equal(parseMime(buildMessage({ ...message, subject: "Plain subject" })).headers.get("subject"), "Plain subject");
});

test("CR/LF в заголовках отклоняются", () => {
  assert.throws(() => buildMessage({ ...message, subject: "Hi\r\nBcc: victim@example.com" }), HeaderInjectionError);
  assert.throws(() => buildMessage({ ...message, subject: "Hi\nX: y" }), HeaderInjectionError);
  assert.throws(() => buildMessage({ ...message, replyTo: { name: "Jane\nBcc: x@y.z", address: "jane@example.com" } }), HeaderInjectionError);
  assert.throws(() => buildMessage({ ...message, replyTo: { address: "jane@example.com\nBcc: x@y.z" } }), HeaderInjectionError);
  assert.throws(() => buildMessage({ ...message, headers: { "X-Test": "a\rb" } }), HeaderInjectionError);
  assert.throws(() => buildMessage({ ...message, headers: { "Bad Name:": "a" } }), HeaderInjectionError);
  assert.throws(() => formatAddress("To", { address: "not-an-email" }));
  assert.throws(() => parseAddress("a@b.c\r\nBcc: x@y.z"), HeaderInjectionError);
  assert.throws(() => buildMessage({ ...message, to: [] }));
});

test("sendmail: аргументы без shell, письмо в stdin, ошибка — по коду выхода", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lead-mail-"));
  const stub = path.join(dir, "sendmail");
  writeFileSync(stub, `#!/bin/sh\nprintf '%s\\n' "$@" > "${dir}/args"\ncat > "${dir}/message"\n`);
  chmodSync(stub, 0o755);
  await sendmailTransport(stub)("Subject: x\n\nbody\n", "noreply@sphagnum.ae");
  assert.equal(readFileSync(path.join(dir, "args"), "utf8"), "-t\n-i\n-f\nnoreply@sphagnum.ae\n");
  assert.equal(readFileSync(path.join(dir, "message"), "utf8"), "Subject: x\n\nbody\n");

  const failing = path.join(dir, "failing");
  writeFileSync(failing, "#!/bin/sh\ncat >/dev/null\necho 'secret@example.com rejected' >&2\nexit 75\n");
  chmodSync(failing, 0o755);
  await assert.rejects(sendmailTransport(failing)("x", "noreply@sphagnum.ae"), { name: "SendmailError", reason: "exit 75" });
  await assert.rejects(sendmailTransport(path.join(dir, "missing"))("x", "noreply@sphagnum.ae"), { reason: "ENOENT" });
  await assert.rejects(sendmailTransport(stub)("x", "-oQ/tmp"), { reason: "badFrom" });
});
