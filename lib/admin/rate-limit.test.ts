import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "./rate-limit.ts";

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
