// Защита входа от перебора: считаем только неудачные попытки, в памяти процесса.
// Для одного `next start` этого хватает; при нескольких инстансах счётчики у каждого свои.

export type RateLimiter = {
  /** Сколько мс ждать до следующей попытки; 0 — можно пробовать. */
  retryAfter(key: string, now?: number): number;
  fail(key: string, now?: number): void;
  reset(key: string): void;
  /** Сколько ключей сейчас хранится (для тестов). */
  size(): number;
};

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const failures = new Map<string, number[]>();

  const recent = (key: string, now: number) => {
    const list = (failures.get(key) ?? []).filter((time) => now - time < windowMs);
    if (list.length) failures.set(key, list);
    else failures.delete(key);
    return list;
  };

  // Перебор с множества адресов не должен раздувать память: сначала выкидываем
  // истёкшие ключи, затем самые давние (Map хранит порядок вставки).
  const evict = (now: number) => {
    if (failures.size < maxKeys) return;
    for (const key of [...failures.keys()]) recent(key, now);
    while (failures.size >= maxKeys) failures.delete(failures.keys().next().value as string);
  };

  return {
    retryAfter(key, now = Date.now()) {
      const list = recent(key, now);
      if (list.length < limit) return 0;
      // Окно скользящее: попытка освободится, когда самая старая из последних `limit` выйдет за окно.
      return list[list.length - limit] + windowMs - now;
    },
    fail(key, now = Date.now()) {
      const list = recent(key, now);
      if (!failures.has(key)) evict(now);
      list.push(now);
      // Перевставляем, чтобы активный ключ ушёл в конец очереди на вытеснение.
      failures.delete(key);
      failures.set(key, list);
    },
    reset(key) {
      failures.delete(key);
    },
    size() {
      return failures.size;
    },
  };
}

const WINDOW_MS = 15 * 60 * 1000;
export const PER_KEY_LIMIT = 10;
export const GLOBAL_LIMIT = 50;
const GLOBAL_KEY = "*";

export type LoginLimiter = {
  retryAfter(key: string, now?: number): number;
  fail(key: string, now?: number): void;
  reset(key: string): void;
};

/**
 * Лимит входа: 10 неудач за 15 минут на ключ (IP) и общий потолок 50 неудач за 15 минут
 * на всех — на случай, если ключи подделывают или их слишком много.
 * Успешный вход сбрасывает только свой ключ: общий счётчик честно доживает до конца окна.
 */
export function createLoginLimiter(perKey = PER_KEY_LIMIT, global = GLOBAL_LIMIT): LoginLimiter {
  const byKey = createRateLimiter({ limit: perKey, windowMs: WINDOW_MS });
  const total = createRateLimiter({ limit: global, windowMs: WINDOW_MS });
  return {
    retryAfter(key, now = Date.now()) {
      return Math.max(byKey.retryAfter(key, now), total.retryAfter(GLOBAL_KEY, now));
    },
    fail(key, now = Date.now()) {
      byKey.fail(key, now);
      total.fail(GLOBAL_KEY, now);
    },
    reset(key) {
      byKey.reset(key);
    },
  };
}

const state = globalThis as typeof globalThis & { __sphLoginLimiter?: LoginLimiter };

/** Общий лимитер входа процесса. */
export function loginLimiter(): LoginLimiter {
  state.__sphLoginLimiter ??= createLoginLimiter();
  return state.__sphLoginLimiter;
}
