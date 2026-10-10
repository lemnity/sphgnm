// Логика POST /api/lead без next/*: роут только читает запрос и отдаёт результат ответом.
import { createRateLimiter } from "../admin/rate-limit.ts";
import { buildMessage, domainOf, parseAddress, parseAddressList, SendmailError, type Address, type SendRaw } from "./mail.ts";
import { createLeadId, leadValues, renderAutoreply, renderNotification } from "./render.ts";
import type { LeadStore, MailStatus } from "./store.ts";
import { validateLead, type Lead } from "./validate.ts";

type Env = Record<string, string | undefined>;

export const MAX_BODY_BYTES = 32 * 1024;
export const DEFAULT_FROM = "Sphagnum Eco <noreply@sphagnum.ae>";

/** Заголовки всех исходящих: письмо автоматическое, автоответчикам на него не отвечать. */
export const NO_REPLY_HEADERS = { "Auto-Submitted": "auto-generated", "X-Auto-Response-Suppress": "All" } as const;

export type LeadErrorBody = { error: string; code: string; field?: string };
export type LeadResult =
  | { status: 200; body: { ok: true } }
  | { status: 400 | 413 | 500; body: LeadErrorBody }
  | { status: 429; body: LeadErrorBody; retryAfter: number };

const errorResult = <S extends 400 | 413 | 500>(status: S, code: string, error: string) => ({ status, body: { error, code } });
export const tooLarge = () => errorResult(413, "tooLarge", "The request is too large.");

/**
 * Лимит: 5 заявок за 10 минут с одного ключа и общий потолок 60 в час.
 * hitKey — только счётчик ключа: срабатывания ловушки не должны выбирать общий потолок,
 * иначе бот с дюжины адресов закроет форму настоящим клиентам на час.
 */
export type LeadLimiter = {
  retryAfter(key: string, now?: number): number;
  hit(key: string, now?: number): void;
  hitKey(key: string, now?: number): void;
};

const GLOBAL_KEY = "*";
export function createLeadLimiter({ perKey = 5, perKeyWindowMs = 10 * 60_000, global = 60, globalWindowMs = 60 * 60_000 } = {}): LeadLimiter {
  const byKey = createRateLimiter({ limit: perKey, windowMs: perKeyWindowMs });
  const total = createRateLimiter({ limit: global, windowMs: globalWindowMs });
  return {
    retryAfter: (key, now = Date.now()) => Math.max(byKey.retryAfter(key, now), total.retryAfter(GLOBAL_KEY, now)),
    hit(key, now = Date.now()) {
      byKey.fail(key, now);
      total.fail(GLOBAL_KEY, now);
    },
    hitKey(key, now = Date.now()) {
      byKey.fail(key, now);
    },
  };
}

const state = globalThis as typeof globalThis & { __sphLeadLimiter?: LeadLimiter; __sphLeadTrapHits?: number };
/** Общий лимитер заявок процесса. */
export function leadLimiter(): LeadLimiter {
  state.__sphLeadLimiter ??= createLeadLimiter();
  return state.__sphLeadLimiter;
}

export type LeadConfig = { to: Address[]; from: Address; autoreply: boolean };

/** Настройки из окружения: LEAD_TO (иначе почта из контактов), LEAD_FROM, LEAD_AUTOREPLY=1. */
export function resolveLeadConfig(env: Env, contactsEmail: string): { config: LeadConfig } | { problem: string } {
  try {
    const to = parseAddressList(env.LEAD_TO?.trim() || contactsEmail);
    if (!to.length) return { problem: "нет получателя: задайте LEAD_TO или почту в контактах" };
    const from = parseAddress(env.LEAD_FROM?.trim() || DEFAULT_FROM);
    return { config: { to, from, autoreply: env.LEAD_AUTOREPLY === "1" } };
  } catch (error) {
    return { problem: `ошибка в LEAD_TO/LEAD_FROM или почте контактов: ${(error as Error).message}` };
  }
}

/** Читает тело потока, но не больше max байт: дальше — null (413). */
export async function readBodyLimited(stream: ReadableStream<Uint8Array> | null, max = MAX_BODY_BYTES): Promise<string | null> {
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export type LeadSite = { projectTypes: readonly string[]; siteUrl: string; salesEmail: string };

/** Свои домены: sphagnum.ae и домен отправителя (LEAD_FROM). */
const OWN_DOMAINS = ["sphagnum.ae"];

/**
 * Можно ли слать автоответ на этот адрес. Не шлём на свои домены (и их поддомены)
 * и на адреса команды и контактов — иначе форма станет способом слать письма от нас нам же.
 * Домены LEAD_TO своими не считаем: команда может сидеть на gmail.com, как и клиенты.
 */
export function autoreplyAllowed(email: string, config: LeadConfig, salesEmail: string): boolean {
  const address = email.toLowerCase();
  const domain = domainOf(address);
  const ours = [...OWN_DOMAINS, domainOf(config.from.address).toLowerCase()];
  if (ours.some((own) => domain === own || domain.endsWith(`.${own}`))) return false;
  const team = [...config.to.map((to) => to.address), salesEmail].map((value) => value.toLowerCase());
  return !team.includes(address);
}

const SEND_FAILED = "We could not send your enquiry. Please try again later or email us directly.";

/**
 * Заявка целиком. Разбор, проверка лимита, проверка полей и запись в лимит идут
 * без await между ними — пачка параллельных запросов не проскочит лимит.
 */
export async function handleLead({
  rawBody,
  key,
  limiter,
  site,
  env = process.env,
  loadTemplates,
  transport,
  now = new Date(),
  log = console,
  background = (task) => void task,
  store,
}: {
  rawBody: string;
  key: string;
  limiter: LeadLimiter;
  site: LeadSite;
  env?: Env;
  loadTemplates: () => Promise<{ notification: string; autoreply: string }>;
  transport: SendRaw;
  now?: Date;
  log?: Pick<Console, "info" | "error">;
  /** Куда отдать фоновую задачу (автоответ); тесты её дожидаются. */
  background?: (task: Promise<void>) => void;
  /** Куда сохранить заявку до отправки письма (кабинет «Заявки»). */
  store?: LeadStore;
}): Promise<LeadResult> {
  let input: unknown;
  try {
    input = JSON.parse(rawBody);
  } catch {
    return errorResult(400, "invalidRequest", "Invalid request.");
  }

  const wait = limiter.retryAfter(key, now.getTime());
  if (wait > 0) {
    return {
      status: 429,
      body: { error: "Too many enquiries. Please try again later.", code: "rateLimited" },
      retryAfter: Math.ceil(wait / 1000),
    };
  }

  const checked = validateLead(input, site.projectTypes);
  if (!checked.ok) return { status: 400, body: { error: checked.error, code: checked.code, ...(checked.field ? { field: checked.field } : {}) } };
  // Ловушка сработала: бот получает обычный ответ, письма нет. Считаем только ключ.
  if ("spam" in checked) {
    limiter.hitKey(key, now.getTime());
    state.__sphLeadTrapHits = (state.__sphLeadTrapHits ?? 0) + 1;
    log.info(`[lead] ловушка: заявка отброшена (всего с запуска: ${state.__sphLeadTrapHits})`);
    return { status: 200, body: { ok: true } };
  }
  limiter.hit(key, now.getTime());
  const { lead } = checked;

  // Сначала сохраняем: сбой почты или настроек не должен потерять заявку.
  const { leadId, saved } = await saveLead(store, lead, now, log);
  const markMail = async (mailStatus: MailStatus) => {
    if (!saved) return;
    await store!.update(leadId, { mailStatus }).catch((error) => log.error(`[lead] ${leadId}: статус письма не записан (${reasonOf(error)})`));
  };

  const resolved = resolveLeadConfig(env, site.salesEmail);
  if ("problem" in resolved) {
    // Наружу — тот же sendFailed: посетителю незачем знать, что сломано у нас.
    log.error(`[lead] почта не настроена: ${resolved.problem}`);
    await markMail("failed");
    return errorResult(500, "sendFailed", SEND_FAILED);
  }
  const { config } = resolved;

  try {
    const templates = await loadTemplates();
    const autoreply = config.autoreply && autoreplyAllowed(lead.email, config, site.salesEmail);
    const values = leadValues({ lead, leadId, now, siteUrl: site.siteUrl, salesEmail: site.salesEmail, autoreply });
    const team = renderNotification(templates.notification, values);
    // Без Reply-To: на уведомление не отвечают, заявки разбираются в кабинете.
    await transport(buildMessage({ from: config.from, to: config.to, ...team, headers: { ...NO_REPLY_HEADERS }, date: now }), config.from.address);
    log.info(`[lead] ${leadId}: заявка отправлена команде`);
    await markMail("sent");

    // Автоответ — по флагу и в фоне: ответ посетителю его не ждёт, сбой только в лог.
    if (config.autoreply) {
      if (!autoreply) {
        log.info(`[lead] ${leadId}: автоответ пропущен — адрес на нашем домене или адрес команды`);
      } else {
        const reply = renderAutoreply(templates.autoreply, values);
        const raw = buildMessage({ from: config.from, to: [{ address: lead.email }], ...reply, headers: { ...NO_REPLY_HEADERS }, date: now });
        background(transport(raw, config.from.address).catch((error) => log.error(`[lead] ${leadId}: автоответ не ушёл (${reasonOf(error)})`)));
      }
    }
    return { status: 200, body: { ok: true } };
  } catch (error) {
    log.error(`[lead] ${leadId}: письмо команде не ушло (${reasonOf(error)})`);
    await markMail("failed");
    return errorResult(500, "sendFailed", SEND_FAILED);
  }
}

/** Запись заявки; номер занят — берём новый. Сбой хранилища — в лог, письмо всё равно уходит. */
async function saveLead(store: LeadStore | undefined, lead: Lead, now: Date, log: Pick<Console, "error">): Promise<{ leadId: string; saved: boolean }> {
  let leadId = createLeadId(now);
  if (!store) return { leadId, saved: false };
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await store.create({ ...lead, id: leadId, submittedAt: now.toISOString(), mailStatus: "pending", read: false });
      return { leadId, saved: true };
    } catch (error) {
      // Предел за сутки, мало места или сбой диска: не сохраняем, но письмо всё равно
      // пробуем отправить — посетитель видит обычный ответ, без причины.
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        log.error(`[lead] ${leadId}: заявка не сохранена (${reasonOf(error)})`);
        return { leadId, saved: false };
      }
      leadId = createLeadId(now);
    }
  }
  log.error(`[lead] ${leadId}: заявка не сохранена (номер занят)`);
  return { leadId, saved: false };
}

// В лог — только причина, без адресов и текста заявки.
const reasonOf = (error: unknown) =>
  error instanceof SendmailError ? error.reason : error instanceof Error ? ((error as NodeJS.ErrnoException).code ?? error.name) : "unknown";
