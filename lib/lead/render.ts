// Письма по заявке: подстановка в HTML-шаблоны из emails/ и текстовая версия.
import { randomInt } from "node:crypto";
import type { Lead } from "./validate.ts";

export const TIME_ZONE = "Asia/Dubai";
const EMPTY = "—";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Все подстановки, которые понимают шаблоны. */
export const PLACEHOLDERS = [
  "leadId",
  "submittedAt",
  "replyBy",
  "name",
  "firstName",
  "email",
  "phone",
  "phoneDigits",
  "region",
  "projectType",
  "area",
  "message",
  "pageUrl",
  "siteUrl",
  "salesEmail",
  "autoreplyNote",
] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];
export type LeadValues = Record<Placeholder, string>;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function dubaiParts(date: Date, locale: string) {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** «10 октября 2026, 14:05 (Дубай)» — время для команды. */
export function formatDubai(date: Date): string {
  const p = dubaiParts(date, "ru-RU");
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} (Дубай)`;
}

// Без похожих символов (0/O, 1/I): номер диктуют по телефону.
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Номер заявки YYMMDD-XXXX, дата — по Дубаю. */
export function createLeadId(date: Date, random: (max: number) => number = randomInt): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => p.find((part) => part.type === type)?.value ?? "";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += ID_ALPHABET[random(ID_ALPHABET.length)];
  return `${get("year")}${get("month")}${get("day")}-${suffix}`;
}

/** Первое слово имени без хвостовой пунктуации: «John Smith, Acme» → «John». */
export function firstNameOf(name: string): string {
  const word = name.trim().split(/\s+/)[0] ?? "";
  return word.replace(/[,.;:!?·—–-]+$/u, "");
}

export function leadValues({
  lead,
  leadId,
  now,
  siteUrl,
  salesEmail,
  autoreply,
}: {
  lead: Lead;
  leadId: string;
  now: Date;
  siteUrl: string;
  salesEmail: string;
  /** Ушёл ли клиенту автоответ — от этого зависит строка в письме команде. */
  autoreply: boolean;
}): LeadValues {
  const or = (value: string) => (value.trim() ? value : EMPTY);
  return {
    leadId,
    submittedAt: formatDubai(now),
    replyBy: formatDubai(new Date(now.getTime() + DAY_MS)),
    name: or(lead.name),
    firstName: or(firstNameOf(lead.name)),
    email: or(lead.email),
    phone: or(lead.phone),
    phoneDigits: or(lead.phone.replace(/\D/g, "")),
    region: or(lead.region),
    projectType: or(lead.projectType),
    area: or(lead.area),
    message: or(lead.message),
    pageUrl: or(siteUrl),
    siteUrl: or(siteUrl),
    salesEmail: or(salesEmail),
    autoreplyNote: autoreply
      ? "Клиент получил автоответ о том, что заявка принята."
      : "Автоответ клиенту не отправлялся — ответьте ему сами.",
  };
}

/** Подстановка в HTML: значения экранируются, переводы строк — в <br />. */
export function fillTemplate(template: string, values: LeadValues): string {
  // Служебные комментарии шаблона (список подстановок, пояснения вёрстки) клиенту не нужны.
  return template.replace(/<!--(?!\[if)[\s\S]*?-->\s*/g, "").replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (match, key: string) =>
    key in values ? escapeHtml(values[key as Placeholder]).replace(/\n/g, "<br />\n") : match,
  );
}

/** Ключи {{…}} из шаблона, которых нет в PLACEHOLDERS (для теста шаблонов). */
export function unknownPlaceholders(template: string): string[] {
  const keys = [...template.matchAll(/\{\{\s*([A-Za-z]+)\s*\}\}/g)].map((match) => match[1]);
  return [...new Set(keys.filter((key) => !(PLACEHOLDERS as readonly string[]).includes(key)))];
}

export type RenderedMail = { subject: string; html: string; text: string };

/** Письмо команде (по-русски). */
export function renderNotification(template: string, v: LeadValues): RenderedMail {
  const projectType = v.projectType === EMPTY ? "" : ` — ${v.projectType}`;
  const text = [
    `Новая заявка № ${v.leadId}`,
    v.submittedAt,
    "",
    `Имя и компания: ${v.name}`,
    `Почта: ${v.email}`,
    `Телефон / WhatsApp: ${v.phone}`,
    `Регион: ${v.region}`,
    `Тип проекта: ${v.projectType}`,
    `Площадь, м²: ${v.area}`,
    "",
    "Сообщение:",
    v.message,
    "",
    `На сайте обещан ответ в течение 24 часов — ответить до ${v.replyBy}.`,
    "",
    `Отправлено с формы на странице ${v.pageUrl}`,
    v.autoreplyNote,
  ].join("\n");
  return { subject: `Заявка № ${v.leadId}: ${v.name}${projectType}`, html: fillTemplate(template, v), text };
}

/** Автоответ клиенту (по-английски). */
export function renderAutoreply(template: string, v: LeadValues): RenderedMail {
  const text = [
    `Thank you, ${v.firstName}.`,
    "",
    "Your enquiry is with us. A substrate specialist is already looking at your project and will reply within 24 hours with a commercial offer.",
    "",
    `Your enquiry · No. ${v.leadId}`,
    `Project type: ${v.projectType}`,
    `Estimated area: ${v.area} m²`,
    `Region / country: ${v.region}`,
    `Name and company: ${v.name}`,
    `Phone / WhatsApp: ${v.phone}`,
    "",
    "Something to add or correct? Simply reply to this email — it goes straight to our sales team.",
    "",
    "SPHAGNUM ECO",
    v.salesEmail,
    v.siteUrl,
    "",
    `You received this email because you submitted an enquiry at ${v.siteUrl}. We never share your contact details with third parties.`,
  ].join("\n");
  return { subject: "We’ve received your enquiry — Sphagnum Eco", html: fillTemplate(template, v), text };
}
