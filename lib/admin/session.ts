// Сессия админки: подписанный токен в httpOnly-cookie, без базы и без хранения на сервере.
// Формат токена: <срок в мс>.<случайная соль>.<HMAC-SHA256 от первых двух частей, base64url>.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "sph_admin";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSessionToken(secret: string, now = Date.now(), ttlMs = SESSION_TTL_MS): string {
  const payload = `${now + ttlMs}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined | null, secret: string, now = Date.now()): boolean {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expires, salt, signature] = parts;
  if (!/^\d+$/.test(expires) || !salt) return false;
  if (!safeEqual(signature, sign(`${expires}.${salt}`, secret))) return false;
  return Number(expires) > now;
}

/** Сравнение пароля без утечки по времени: сравниваем хэши одинаковой длины. */
export function checkPassword(input: string, expected: string): boolean {
  if (!expected) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(input), digest(expected));
}

type Env = Record<string, string | undefined>;

export type SecretResult = { secret: string } | { error: string };

// Модули роутов в Next собираются раздельно, поэтому общее состояние процесса держим на globalThis.
const state = globalThis as typeof globalThis & { __sphAdminDevSecret?: string; __sphAdminShortSecretWarned?: boolean };

/**
 * Секрет подписи. В dev без ADMIN_SESSION_SECRET берём случайный на время жизни процесса
 * (после перезапуска сервера придётся войти заново). В production без секрета вход запрещён.
 */
export const MIN_SECRET_LENGTH = 32;

export function resolveSessionSecret(env: Env = process.env): SecretResult {
  const secret = env.ADMIN_SESSION_SECRET?.trim();
  if (secret) {
    if (secret.length >= MIN_SECRET_LENGTH) return { secret };
    // Короткий секрет подбирается перебором, а с ним — подделка любой сессии.
    if (env.NODE_ENV === "production") {
      return { error: `ADMIN_SESSION_SECRET короче ${MIN_SECRET_LENGTH} символов: вход в админку отключён. Задайте длинную случайную строку (см. .env.example).` };
    }
    if (!state.__sphAdminShortSecretWarned) {
      state.__sphAdminShortSecretWarned = true;
      console.warn(`[admin] ADMIN_SESSION_SECRET короче ${MIN_SECRET_LENGTH} символов — в production вход с ним будет отключён.`);
    }
    return { secret };
  }
  if (env.NODE_ENV === "production") {
    return { error: "ADMIN_SESSION_SECRET не задан: вход в админку отключён. Задайте его в .env.local (см. .env.example)." };
  }
  if (!state.__sphAdminDevSecret) {
    state.__sphAdminDevSecret = randomBytes(32).toString("hex");
    console.warn("[admin] ADMIN_SESSION_SECRET не задан — используется временный секрет, сессии сбросятся при перезапуске.");
  }
  return { secret: state.__sphAdminDevSecret };
}

/**
 * Настройки cookie. secure — в production; выключается только явным ADMIN_COOKIE_SECURE=false,
 * пока на сервере нет HTTPS (иначе браузер не сохранит cookie и вход молча не сработает).
 * Любое другое значение, включая опечатки, оставляет Secure.
 */
export function sessionCookieOptions(env: Env = process.env) {
  const secure = env.NODE_ENV === "production" && env.ADMIN_COOKIE_SECURE !== "false";
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}
