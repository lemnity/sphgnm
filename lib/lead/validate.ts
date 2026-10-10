// Проверка и нормализация заявки с формы. Без зависимостей — гоняется через node --test.

export type Lead = {
  name: string;
  email: string;
  phone: string;
  region: string;
  projectType: string;
  area: string;
  message: string;
};

export type LeadField = keyof Lead;

/** Предельные длины полей (после trim). */
export const LEAD_LIMITS: Record<LeadField, number> = {
  name: 200,
  email: 254,
  phone: 40,
  region: 120,
  projectType: 120,
  area: 40,
  message: 4000,
};

/** Имя поля-ловушки: человек его не видит, бот заполняет. */
export const HONEYPOT_FIELD = "website";

export type LeadErrorCode = "invalidRequest" | "nameRequired" | "emailRequired" | "invalidEmail" | "invalidProjectType" | "tooLong";

export type LeadValidation =
  | { ok: true; lead: Lead }
  | { ok: true; spam: true }
  | { ok: false; code: LeadErrorCode; error: string; field?: LeadField };

// Тексты ошибок — по-английски: публичный сайт английский.
const MESSAGES: Record<LeadErrorCode, string> = {
  invalidRequest: "Invalid request.",
  nameRequired: "Please enter your name and company.",
  emailRequired: "Please enter your email.",
  invalidEmail: "Please enter a valid email address.",
  invalidProjectType: "Please choose a project type from the list.",
  tooLong: "One of the fields is too long.",
};

// Только ASCII: адрес уходит в заголовок Reply-To без кодирования.
const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function isEmail(value: string): boolean {
  return value.length <= LEAD_LIMITS.email && EMAIL_RE.test(value);
}

// Управляющие символы (кроме переводов строк и табуляции) выкидываем везде.
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/g;

/** Однострочное поле: любые пробелы и переводы строк — в один пробел. */
const singleLine = (value: string) => value.replace(CONTROL_RE, "").replace(/\s+/g, " ").trim();
/** Многострочное: переводы строк к \n, лишние пустые строки схлопываем. */
const multiLine = (value: string) =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const fail = (code: LeadErrorCode, field?: LeadField): LeadValidation => ({ ok: false, code, error: MESSAGES[code], ...(field ? { field } : {}) });

/**
 * Разбор тела запроса. projectTypes — варианты из contact.form.projectTypes:
 * тип проекта либо пустой, либо ровно один из них.
 */
export function validateLead(input: unknown, projectTypes: readonly string[]): LeadValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail("invalidRequest");
  const raw = input as Record<string, unknown>;

  // Ловушка заполнена — делаем вид, что всё хорошо, но ничего не шлём.
  const trap = raw[HONEYPOT_FIELD];
  if (typeof trap === "string" ? trap.trim() !== "" : trap != null && trap !== false) return { ok: true, spam: true };

  const fields: LeadField[] = ["name", "email", "phone", "region", "projectType", "area", "message"];
  const lead = {} as Lead;
  for (const field of fields) {
    const value = raw[field];
    if (value != null && typeof value !== "string") return fail("invalidRequest");
    const text = field === "message" ? multiLine(value ?? "") : singleLine(value ?? "");
    if (text.length > LEAD_LIMITS[field]) return fail("tooLong", field);
    lead[field] = text;
  }

  if (!lead.name) return fail("nameRequired", "name");
  if (!lead.email) return fail("emailRequired", "email");
  if (!isEmail(lead.email)) return fail("invalidEmail", "email");
  if (lead.projectType && !projectTypes.some((type) => singleLine(type) === lead.projectType)) return fail("invalidProjectType", "projectType");
  return { ok: true, lead };
}
