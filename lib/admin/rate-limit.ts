// Защита входа от перебора: считаем только неудачные попытки, в памяти процесса.
// Для одного `next start` этого хватает; при нескольких инстансах счётчики у каждого свои.

export type RateLimiter = {
  /** Сколько мс ждать до следующей попытки; 0 — можно пробовать. */
  retryAfter(key: string, now?: number): number;
  fail(key: string, now?: number): void;
  reset(key: string): void;
};

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const failures = new Map<string, number[]>();

  const recent = (key: string, now: number) => {
    const list = (failures.get(key) ?? []).filter((time) => now - time < windowMs);
    if (list.length) failures.set(key, list);
    else failures.delete(key);
    return list;
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
      list.push(now);
      failures.set(key, list);
    },
    reset(key) {
      failures.delete(key);
    },
  };
}

const state = globalThis as typeof globalThis & { __sphLoginLimiter?: RateLimiter };

/** Общий лимитер входа: 10 неудачных попыток за 15 минут с одного IP. */
export function loginLimiter(): RateLimiter {
  state.__sphLoginLimiter ??= createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });
  return state.__sphLoginLimiter;
}
