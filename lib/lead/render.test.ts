import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLeadId, escapeHtml, firstNameOf, formatDubai, leadValues, renderAutoreply, renderNotification, unknownPlaceholders } from "./render.ts";
import type { Lead } from "./validate.ts";

const template = (name: string) => readFileSync(new URL(`../../emails/${name}`, import.meta.url), "utf8");
const notification = template("lead-notification.html");
const autoreply = template("lead-autoreply.html");

// 2026-10-10 20:30 UTC = 11 октября 00:30 в Дубае (UTC+4)
const now = new Date("2026-10-10T20:30:00Z");
const lead: Lead = {
  name: "<script>alert(1)</script> & Co",
  email: "jane@example.com",
  phone: "+971 (50) 123-45-67",
  region: "",
  projectType: "Other",
  area: "1 200",
  message: "Hi \"team\"\nSecond line",
};
const values = leadValues({ lead, leadId: "261011-AB2C", now, siteUrl: "https://sphagnum.ae", salesEmail: "sales@sphagnum.ae", autoreply: false });

test("шаблоны знают только известные подстановки", () => {
  assert.deepEqual(unknownPlaceholders(notification), []);
  assert.deepEqual(unknownPlaceholders(autoreply), []);
});

test("все подстановки заполнены, значения экранированы", () => {
  for (const mail of [renderNotification(notification, values), renderAutoreply(autoreply, values)]) {
    assert.doesNotMatch(mail.html, /\{\{/);
    assert.doesNotMatch(mail.html, /<script>alert/);
  }
  const html = renderNotification(notification, values).html;
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; Co/);
  assert.match(html, /Hi &quot;team&quot;<br \/>\nSecond line/);
  assert.match(html, /wa\.me\/971501234567/);
  assert.match(html, /Автоответ клиенту не отправлялся/);
});

test("пустые поля — «—», значения по Дубаю", () => {
  assert.equal(values.region, "—");
  assert.equal(values.submittedAt, "11 октября 2026, 00:30 (Дубай)");
  assert.equal(values.replyBy, "12 октября 2026, 00:30 (Дубай)");
  assert.equal(values.phoneDigits, "971501234567");
  assert.equal(leadValues({ lead: { ...lead, phone: "" }, leadId: "x", now, siteUrl: "", salesEmail: "", autoreply: true }).phoneDigits, "—");
  assert.equal(formatDubai(new Date("2026-01-05T08:07:00Z")), "5 января 2026, 12:07 (Дубай)");
});

test("номер заявки YYMMDD-XXXX по дате в Дубае", () => {
  assert.equal(createLeadId(now, () => 0), "261011-AAAA");
  assert.match(createLeadId(now), /^261011-[A-HJ-NP-Z2-9]{4}$/);
});

test("имя для обращения", () => {
  assert.equal(firstNameOf("John Smith, Acme"), "John");
  assert.equal(firstNameOf("John, Acme"), "John");
  assert.equal(firstNameOf("  Анна  "), "Анна");
});

test("текстовые версии содержат значения без HTML-экранирования", () => {
  const team = renderNotification(notification, values);
  assert.match(team.text, /Имя и компания: <script>alert\(1\)<\/script> & Co/);
  assert.match(team.text, /Регион: —/);
  assert.match(team.text, /Hi "team"\nSecond line/);
  assert.equal(team.subject, "Заявка № 261011-AB2C: <script>alert(1)</script> & Co — Other");
  const reply = renderAutoreply(autoreply, values);
  assert.match(reply.text, /^Thank you, <script>alert\(1\)<\/script>\./);
  assert.match(reply.text, /No\. 261011-AB2C/);
  assert.match(reply.text, /sales@sphagnum\.ae/);
});

test("escapeHtml", () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});

test("служебные комментарии шаблона в письмо не попадают", () => {
  const html = renderNotification(notification, values).html;
  assert.doesNotMatch(html, /<!--/);
  assert.match(html, /^<!doctype html>\n<html lang="ru"/);
});
