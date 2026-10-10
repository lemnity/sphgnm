import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AUTOREPLY_PLACEHOLDERS,
  createLeadId,
  escapeHtml,
  fillTemplate,
  firstNameOf,
  formatDubai,
  greetingFor,
  leadValues,
  adminUrlOf,
  PLACEHOLDERS,
  renderAutoreply,
  renderNotification,
  unknownPlaceholders,
} from "./render.ts";
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
  assert.deepEqual(unknownPlaceholders(notification, PLACEHOLDERS), []);
  // В автоответе — только безопасный набор.
  assert.deepEqual(unknownPlaceholders(autoreply, AUTOREPLY_PLACEHOLDERS), []);
});

test("все подстановки заполнены, значения экранированы", () => {
  for (const mail of [renderNotification(notification, values), renderAutoreply(autoreply, values)]) {
    assert.doesNotMatch(mail.html, /\{\{/);
    assert.doesNotMatch(mail.html, /<script>alert/);
  }
  const html = renderNotification(notification, values).html;
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; Co/);
  assert.match(html, /Hi &quot;team&quot;<br \/>\nSecond line/);
  assert.match(html, /\+971 \(50\) 123-45-67/);
  assert.match(html, /Автоответ клиенту не отправлялся/);
  assert.doesNotMatch(html, /—"/); // «—» в href не попадает
});

test("пустые поля — «—», значения по Дубаю", () => {
  assert.equal(values.region, "—");
  assert.equal(values.submittedAt, "11 октября 2026, 00:30 (Дубай)");
  assert.equal(values.replyBy, "12 октября 2026, 00:30 (Дубай)");
  assert.equal(values.adminUrl, "https://sphagnum.ae/admin");
  assert.equal(leadValues({ lead: { ...lead, phone: "" }, leadId: "x", now, siteUrl: "", salesEmail: "", autoreply: true }).phone, "—");
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
  assert.match(reply.text, /^Thank you\.\n/);
  assert.match(reply.text, /No\. 261011-AB2C/);
  assert.match(reply.text, /sales@sphagnum\.ae/);
});

test("автоответ не пересылает свободный текст из формы", () => {
  const evil: Lead = {
    name: "Anna CLICK-https://evil.example/login",
    email: "anna@example.com",
    phone: "+1 VERIFY YOUR ACCOUNT",
    region: "Visit evil.example now",
    projectType: "Other",
    area: "Reset password at evil.example",
    message: "phishing body",
  };
  const v = leadValues({ lead: evil, leadId: "261011-AB2C", now, siteUrl: "https://sphagnum.ae", salesEmail: "sales@sphagnum.ae", autoreply: true });
  // Даже если в шаблон вернут {{name}} и прочее — подставится пусто.
  const sneaky = `${autoreply}{{name}}|{{region}}|{{phone}}|{{area}}|{{message}}|{{email}}`;
  const reply = renderAutoreply(sneaky, v);
  for (const part of [reply.html, reply.text, reply.subject]) {
    assert.doesNotMatch(part, /evil\.example|VERIFY|phishing|CLICK/);
  }
  assert.match(reply.html, /Thank you, Anna\.<br \/>/);
  assert.match(reply.html, /\|\|\|\|\|$/);
  assert.match(reply.html, />Other</);
});

test("обращение в автоответе: только короткое имя из букв", () => {
  assert.equal(greetingFor("Anna Petrova, Acme"), "Thank you, Anna.");
  assert.equal(greetingFor("Jean-Luc"), "Thank you, Jean-Luc.");
  assert.equal(greetingFor("O’Neil"), "Thank you, O’Neil.");
  assert.equal(greetingFor("Анна"), "Thank you, Анна.");
  assert.equal(greetingFor("https://evil.example"), "Thank you.");
  assert.equal(greetingFor("Win$$$"), "Thank you.");
  assert.equal(greetingFor("A".repeat(31)), "Thank you.");
  assert.equal(greetingFor("A".repeat(30)), `Thank you, ${"A".repeat(30)}.`);
  assert.equal(greetingFor(""), "Thank you.");
});

test("адрес кабинета — адрес сайта + /admin", () => {
  assert.equal(adminUrlOf("https://sphagnum.ae/"), "https://sphagnum.ae/admin");
  assert.equal(adminUrlOf("https://example.com/sub"), "https://example.com/sub/admin");
  assert.equal(adminUrlOf(""), "");
});

test("уведомление только для чтения: ни mailto:, ни tel:, ни WhatsApp, ни «Ответить»", () => {
  for (const v of [values, leadValues({ lead: { ...lead, phone: "" }, leadId: "x", now, siteUrl: "", salesEmail: "", autoreply: false })]) {
    const mail = renderNotification(notification, v);
    assert.doesNotMatch(mail.html, /mailto:|tel:|wa\.me|Ответить клиенту/i);
    assert.doesNotMatch(mail.html, /\{\{[#^/]/);
  }
  const mail = renderNotification(notification, values);
  assert.match(mail.html, />jane@example\.com</);
  assert.match(mail.html, /Это автоматическое уведомление — отвечать на него не нужно\. Все заявки — в кабинете: <span[^>]*>https:\/\/sphagnum\.ae\/admin</);
  assert.match(mail.text, /в кабинете: https:\/\/sphagnum\.ae\/admin$/);
  const reply = renderAutoreply(autoreply, values);
  assert.match(reply.html, /This is an automated message, please do not reply\./);
  assert.match(reply.text, /This is an automated message, please do not reply\./);
  assert.doesNotMatch(reply.html + reply.text, /Simply reply/);
});

test("секции шаблона", () => {
  assert.equal(fillTemplate("a{{#f}}B{{x}}{{/f}}{{^f}}C{{/f}}d", { x: "<1>" }, { f: true }), "aB&lt;1&gt;d");
  assert.equal(fillTemplate("a{{#f}}B{{/f}}{{^f}}C{{/f}}d", {}, { f: false }), "aCd");
});

test("escapeHtml", () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});

test("служебные комментарии шаблона в письмо не попадают", () => {
  const html = renderNotification(notification, values).html;
  assert.doesNotMatch(html, /<!--/);
  assert.match(html, /^<!doctype html>\n<html lang="ru"/);
});
