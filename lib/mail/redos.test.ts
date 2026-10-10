// Время разбора на враждебных письмах: всё должно быть линейным. Список писем читает
// заголовки каждой строки в том же процессе, что принимает заявки, — квадрат здесь
// останавливает весь сайт.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLeadId, fillTemplate, leadValues, renderNotification } from "../lead/render.ts";
import { csvCell, toCsv } from "../lead/store.ts";
import { isEmail, validateLead } from "../lead/validate.ts";
import { decodeMailboxName, splitName } from "./maildir.ts";
import {
  decodeBase64,
  decodeQuotedPrintable,
  decodeWords,
  displayText,
  htmlToText,
  isoDate,
  parseHeaders,
  parseMessage,
  parseParams,
  safeFileName,
  splitAddress,
  splitHeadBody,
  splitMultipart,
  summarize,
} from "./parse.ts";
import { sanitizeHtml } from "./sanitize.ts";

const MB = 1024 * 1024;
// Начало HTML-комментария собираем из частей: так нагляднее в отчёте о падении.
const COMMENT_OPEN = "<!" + "--";
const fill = (unit: string, size = MB) => unit.repeat(Math.ceil(size / unit.length)).slice(0, size);

/**
 * Средний из трёх прогонов не дольше budget мс (первый прогон греет JIT). Запас — на
 * параллельный npm test на слабой машине: квадратичная регрессия уходит в секунды.
 */
function within(budget: number, label: string, run: () => unknown) {
  run();
  const times: number[] = [];
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    run();
    times.push(performance.now() - started);
  }
  const median = times.sort((a, b) => a - b)[1];
  assert.ok(median < budget, `${label}: ${Math.round(median)} мс (лимит ${budget})`);
}

test("C1: Date из 100 строк по 900 «(» — summarize быстрее 100 мс", () => {
  const folded = "Date: x\r\n" + Array.from({ length: 100 }, () => " " + "(".repeat(900)).join("\r\n") + "\r\nSubject: s\r\n\r\nbody";
  within(100, "summarize, свёрнутый Date", () => summarize(Buffer.from(folded, "latin1")));
  within(100, "summarize, Date из 100 КБ «(»", () => summarize(`Date: ${"(".repeat(100_000)}\r\n\r\nx`));
  within(100, "parseMessage, Date « (»×50000", () => parseMessage(`Date: x${" (".repeat(50_000)}\r\n\r\nb`));
  assert.equal(isoDate("Sat, 10 Oct 2026 12:05:00 +0400 (GST)"), "2026-10-10T08:05:00.000Z");
  assert.equal(isoDate("(".repeat(100_000)), null);
});

test("I1: htmlToText на 1 МБ враждебного HTML — линейно", () => {
  for (const [label, html] of [
    ["«<head»", fill("<head")],
    ["«<»", fill("<")],
    ["пробелы", fill(" ") + "x"],
    ["«<script>» без закрытия", fill("<script>")],
    ["«<script></script>»", fill("<script></script>")],
    ["«<style></stylex»", fill("<style></stylex")],
    ["«&#»", fill("&#")],
    ["начало комментария", fill(COMMENT_OPEN)],
    ["« \\n»", fill(" \t\n")],
  ] as const) {
    within(300, `htmlToText ${label}`, () => htmlToText(html));
  }
  // 300 КБ «<» в base64 text/html без text/plain — превью строится из HTML.
  const body = Buffer.from("<".repeat(300_000)).toString("base64").replace(/.{76}/g, "$&\r\n");
  within(300, "parseMessage html-only «<»", () => parseMessage(`Content-Type: text/html\r\nContent-Transfer-Encoding: base64\r\n\r\n${body}`));
});

test("sanitizeHtml на 1 МБ враждебного HTML — линейно", () => {
  for (const [label, html] of [
    ["«<a »", fill("<a ")],
    ["«<script>»", fill("<script>")],
    ["«<script></script>»", fill("<script></script>")],
    ["«<title></titlex»", fill("<title></titlex")],
    ["«<»", fill("<")],
    ["незакрытая кавычка", fill('<a x="')],
    ["начало комментария", fill(COMMENT_OPEN)],
    ["«<!»", fill("<!")],
    ["атрибуты", "<p " + fill("a=b ") + ">"],
    ["сущности в href", '<a href="' + fill("&#x61;") + '">'],
    ["стиль", '<p style="' + fill("url(") + '">'],
  ] as const) {
    within(300, `sanitizeHtml ${label}`, () => sanitizeHtml(html));
  }
});

test("заголовки, параметры, encoded-words, декодеры — линейно на 1 МБ", () => {
  const cases: [string, () => unknown][] = [
    ["decodeWords «=?»", () => decodeWords(fill("=?"))],
    ["decodeWords «=?x?B?»", () => decodeWords(fill("=?x?B?"))],
    ["decodeWords много слов", () => decodeWords(fill("=?utf-8?B?0JA=?= "))],
    ["decodeWords разные кодировки", () => decodeWords(fill("=?x-a?Q?a?= =?x-b?Q?b?= "))],
    ["decodeWords 8 бит", () => decodeWords(fill("\xd0\x90\xff"))],
    ["parseParams «x*»", () => parseParams("a; " + fill("x*"))],
    ["parseParams много параметров", () => parseParams("a" + fill("; n*0*=utf-8''%41"))],
    ["parseParams кавычки", () => parseParams("a; n=" + fill('"\\'))],
    ["parseParams апострофы", () => parseParams("a; n*=" + fill("'"))],
    ["parseHeaders продолжения", () => parseHeaders("A:" + fill("\n "))],
    ["parseHeaders двоеточия", () => parseHeaders(fill(":\n"))],
    ["splitHeadBody «\\r»", () => splitHeadBody(fill("\r"))],
    ["QP «=»", () => decodeQuotedPrintable(fill("="))],
    ["QP «=\\r»", () => decodeQuotedPrintable(fill("=\r"))],
    ["base64 мусор", () => decodeBase64(fill("!@#$"))],
    ["splitMultipart «\\n-»", () => splitMultipart(fill("\n-"), "b")],
    ["splitMultipart «\\n--b »", () => splitMultipart(fill("\n--b      x"), "b")],
    ["splitAddress пробелы", () => splitAddress(fill(" ") + "x")],
    ["splitAddress «\"»", () => splitAddress(fill('"'))],
    ["safeFileName", () => safeFileName(fill("/‮"), "f")],
    ["displayText", () => displayText(fill(" ‮"))],
    ["decodeMailboxName", () => decodeMailboxName(fill("&A"))],
    ["splitName", () => splitName(fill(":2,"))],
  ];
  for (const [label, run] of cases) within(300, label, run);
});

test("parseMessage и summarize на 1 МБ враждебных писем — линейно", () => {
  const messages: [string, string][] = [
    ["без заголовков", fill("x")],
    ["много границ", "Content-Type: multipart/mixed; boundary=b\r\n\r\n" + fill("\n--b\n")],
    ["вложенные границы", "Content-Type: multipart/mixed; boundary=b\r\n\r\n" + fill("--b\r\nContent-Type: multipart/mixed; boundary=b\r\n\r\n")],
    ["длинная граница", `Content-Type: multipart/mixed; boundary=${"b".repeat(500_000)}\r\n\r\n` + fill("\n--b")],
    ["длинная тема", "Subject: " + fill("=?utf-8?Q?=D0=90?= ") + "\r\n\r\nx"],
    ["длинный From", "From: " + fill(' "<a') + "\r\n\r\nx"],
    ["много вложений", "Content-Type: multipart/mixed; boundary=b\r\n\r\n" + fill('--b\r\nContent-Disposition: attachment; filename="a"\r\n\r\nx\r\n')],
    ["QP-тело", "Content-Transfer-Encoding: quoted-printable\r\n\r\n" + fill("=\r\n=4")],
    ["name= в теле", "Content-Type: multipart/mixed\r\n\r\n" + fill("name      ")],
  ];
  for (const [label, raw] of messages) {
    within(300, `parseMessage ${label}`, () => parseMessage(raw));
    within(300, `summarize ${label}`, () => summarize(raw.slice(0, 128 * 1024)));
  }
});

test("заявки: проверка, письмо и CSV на враждебном вводе — линейно", () => {
  const types = ["Other"];
  const body = { name: fill(",", 200), email: fill("a.", 254), phone: fill("+", 40), region: fill(" ", 120), area: "1", message: fill(" \n", 4000), projectType: "Other" };
  within(300, "validateLead", () => validateLead(body, types));
  within(300, "isEmail длинный", () => isEmail(fill("a-", 300) + "@" + fill("a-", 300)));
  const lead = { name: fill("{{name}}", 200), email: "a@b.co", phone: "", region: fill("{{#x}}", 120), projectType: "", area: "", message: fill("{{/x}}<", 4000) };
  const values = leadValues({ lead, leadId: createLeadId(new Date()), now: new Date(), siteUrl: "https://x", salesEmail: "s@x.co", autoreply: false });
  within(300, "renderNotification", () => renderNotification(fill("{{message}}{{#hasPhone}}", 20_000), values));
  within(300, "fillTemplate", () => fillTemplate("{{#a}}" + fill("{{x}}", 50_000), { x: fill("{{", 4000) }));
  within(300, "CSV", () => toCsv(["a"], [[fill('"=,', MB)]]));
  assert.equal(csvCell("=1"), "'=1");
});
