import { test } from "node:test";
import assert from "node:assert/strict";
import { createLoginLimiter, createRateLimiter } from "./rate-limit.ts";

const WINDOW = 15 * 60 * 1000;

test("10 неудач пропускаются, дальше блок до выхода самой старой из окна", () => {
  const limiter = createRateLimiter({ limit: 10, windowMs: WINDOW });
  const start = 1_000_000;
  for (let i = 0; i < 10; i += 1) {
    assert.equal(limiter.retryAfter("1.2.3.4", start + i), 0);
    limiter.fail("1.2.3.4", start + i);
  }
  assert.equal(limiter.retryAfter("1.2.3.4", start + 10), WINDOW - 10);
  assert.equal(limiter.retryAfter("1.2.3.4", start + WINDOW), 0);
});

test("счётчики у разных IP раздельные", () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: WINDOW });
  limiter.fail("a", 0);
  limiter.fail("a", 1);
  assert.ok(limiter.retryAfter("a", 2) > 0);
  assert.equal(limiter.retryAfter("b", 2), 0);
});

test("успешный вход сбрасывает счётчик", () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: WINDOW });
  limiter.fail("a", 0);
  limiter.fail("a", 1);
  limiter.reset("a");
  assert.equal(limiter.retryAfter("a", 2), 0);
});

test("старые неудачи забываются", () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: WINDOW });
  limiter.fail("a", 0);
  limiter.fail("a", WINDOW + 1);
  assert.equal(limiter.retryAfter("a", WINDOW + 2), 0);
});

test("число ключей ограничено: истёкшие и самые давние вытесняются", () => {
  const limiter = createRateLimiter({ limit: 3, windowMs: WINDOW, maxKeys: 100 });
  for (let i = 0; i < 1000; i += 1) limiter.fail(`k${i}`, i);
  assert.ok(limiter.size() <= 100, `ключей: ${limiter.size()}`);
  // Свежий ключ на месте, самый первый вытеснен.
  limiter.fail("k999", 1000);
  limiter.fail("k999", 1001);
  assert.ok(limiter.retryAfter("k999", 1002) > 0);
  assert.equal(limiter.retryAfter("k0", 1002), 0);
});

test("общий потолок: не больше 50 неудач за 15 минут по всем ключам", () => {
  const limiter = createLoginLimiter();
  for (let i = 0; i < 50; i += 1) {
    assert.equal(limiter.retryAfter(`ip${i}`, i), 0);
    limiter.fail(`ip${i}`, i);
  }
  assert.ok(limiter.retryAfter("ещё-не-было", 50) > 0);
  assert.equal(limiter.retryAfter("ещё-не-было", WINDOW + 50), 0);
});

test("общий потолок не сбрасывается успешным входом", () => {
  const limiter = createLoginLimiter(10, 3);
  limiter.fail("a", 0);
  limiter.fail("b", 1);
  limiter.fail("c", 2);
  limiter.reset("a");
  assert.ok(limiter.retryAfter("a", 3) > 0);
});
