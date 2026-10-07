// Логика входа без next/*: роут только читает запрос и превращает результат в ответ.
import type { LoginLimiter } from "./rate-limit.ts";
import { checkPassword } from "./session.ts";

type Env = Record<string, string | undefined>;

/**
 * Ключ для лимита попыток. Заголовки X-Real-IP / X-Forwarded-For задаёт кто угодно,
 * поэтому верим им только за своим прокси (ADMIN_TRUST_PROXY=1, nginx ставит X-Real-IP).
 * Без прокси адреса сокета в route handler нет — тогда все делят один ключ.
 */
export function rateLimitKey(headers: { get(name: string): string | null }, env: Env = process.env): string {
  if (env.ADMIN_TRUST_PROXY !== "1") return "direct";
  const real = headers.get("x-real-ip")?.trim();
  if (real) return `ip:${real}`;
  // Последний адрес дописал ближайший (наш) прокси, остальные мог подставить клиент.
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
  return forwarded?.length ? `ip:${forwarded.at(-1)}` : "direct";
}

export type LoginResult = { status: 200 } | { status: 400 | 401; error: string } | { status: 429; error: string; retryAfter: number };

/**
 * Попытка входа. Тело читается ДО проверки лимита, а проверка, сравнение пароля и запись
 * неудачи идут без await между ними: иначе пачка параллельных запросов проскочила бы
 * проверку лимита раньше, чем первый из них успел записать неудачу.
 */
export async function attemptLogin({
  readPassword,
  key,
  expected,
  limiter,
}: {
  readPassword: () => Promise<unknown>;
  key: string;
  expected: string;
  limiter: LoginLimiter;
}): Promise<LoginResult> {
  let input: unknown;
  let parsed = true;
  try {
    input = await readPassword();
  } catch {
    parsed = false;
  }

  // Дальше — синхронно.
  const wait = limiter.retryAfter(key);
  if (wait > 0) {
    const seconds = Math.ceil(wait / 1000);
    return { status: 429, error: `Слишком много попыток. Попробуйте через ${Math.ceil(seconds / 60)} мин.`, retryAfter: seconds };
  }
  if (!parsed) return { status: 400, error: "Ожидается { password }" };
  if (typeof input !== "string" || !checkPassword(input, expected)) {
    limiter.fail(key);
    return { status: 401, error: "Неверный пароль" };
  }
  limiter.reset(key);
  return { status: 200 };
}
