// Логика POST /api/lead без next/*: роут только читает запрос и отдаёт результат ответом.
import { createRateLimiter } from "../admin/rate-limit.ts";
import { buildMessage, parseAddress, parseAddressList, SendmailError, type Address, type SendRaw } from "./mail.ts";
import { createLeadId, leadValues, renderAutoreply, renderNotification } from "./render.ts";
import { validateLead } from "./validate.ts";

type Env = Record<string, string | undefined>;

export const MAX_BODY_BYTES = 32 * 1024;
export const DEFAULT_FROM = "Sphagnum Eco <noreply@sphagnum.ae>";

export type LeadErrorBody = { error: string; code: string; field?: string };
export type LeadResult =
  | { status: 200; body: { ok: true } }
  | { status: 400 | 413 | 500; body: LeadErrorBody }
  | { status: 429; body: LeadErrorBody; retryAfter: number };

const errorResult = <S extends 400 | 413 | 500>(status: S, code: string, error: string) => ({ status, body: { error, code } });
export const tooLarge = () => errorResult(413, "tooLarge", "The request is too large.");

/** Лимит: 5 заявок за 10 минут с одного ключа и общий потолок 60 в час. */
export type LeadLimiter = { retryAfter(key: string, now?: number): number; hit(key: string, now?: number): void };

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
  };
}

const state = globalThis as typeof globalThis & { __sphLeadLimiter?: LeadLimiter };
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
  limiter.hit(key, now.getTime());
  // Ловушка сработала: бот получает обычный ответ, письма нет.
  if ("spam" in checked) return { status: 200, body: { ok: true } };
  const { lead } = checked;

  const resolved = resolveLeadConfig(env, site.salesEmail);
  if ("problem" in resolved) {
    log.error(`[lead] почта не настроена: ${resolved.problem}`);
    return errorResult(500, "notConfigured", "We could not send your enquiry. Please email us directly.");
  }
  const { config } = resolved;

  const leadId = createLeadId(now);
  try {
    const templates = await loadTemplates();
    const values = leadValues({ lead, leadId, now, siteUrl: site.siteUrl, salesEmail: site.salesEmail, autoreply: config.autoreply });
    const team = renderNotification(templates.notification, values);
    await transport(
      buildMessage({ from: config.from, to: config.to, replyTo: { name: lead.name, address: lead.email }, ...team, date: now }),
      config.from.address,
    );
    log.info(`[lead] ${leadId}: заявка отправлена команде`);

    // Автоответ — по флагу; его сбой заявку не теряет, команде письмо уже ушло.
    if (config.autoreply) {
      try {
        const reply = renderAutoreply(templates.autoreply, values);
        await transport(
          buildMessage({
            from: config.from,
            to: [{ name: lead.name, address: lead.email }],
            replyTo: config.to[0],
            ...reply,
            headers: { "Auto-Submitted": "auto-replied" },
            date: now,
          }),
          config.from.address,
        );
      } catch (error) {
        log.error(`[lead] ${leadId}: автоответ не ушёл (${reasonOf(error)})`);
      }
    }
    return { status: 200, body: { ok: true } };
  } catch (error) {
    log.error(`[lead] ${leadId}: письмо команде не ушло (${reasonOf(error)})`);
    return errorResult(500, "sendFailed", "We could not send your enquiry. Please try again later or email us directly.");
  }
}

// В лог — только причина, без адресов и текста заявки.
const reasonOf = (error: unknown) =>
  error instanceof SendmailError ? error.reason : error instanceof Error ? ((error as NodeJS.ErrnoException).code ?? error.name) : "unknown";
