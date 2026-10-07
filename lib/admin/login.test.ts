import { test } from "node:test";
import assert from "node:assert/strict";
import { attemptLogin, rateLimitKey } from "./login.ts";
import { createLoginLimiter } from "./rate-limit.ts";

const headers = (values: Record<string, string>) => new Headers(values);

// Тело приходит не сразу — как настоящий request.json().
const slowBody = (password: unknown) => () => new Promise((resolve) => setTimeout(() => resolve(password), Math.random() * 5));

test("20 параллельных неверных попыток: не больше 10 получают 401, остальные 429", async () => {
  const limiter = createLoginLimiter();
  const results = await Promise.all(
    Array.from({ length: 20 }, () => attemptLogin({ readPassword: slowBody("wrong"), key: "direct", expected: "secret", limiter })),
  );
  const counts = results.reduce<Record<number, number>>((acc, { status }) => ({ ...acc, [status]: (acc[status] ?? 0) + 1 }), {});
  assert.deepEqual(counts, { 401: 10, 429: 10 });
});

test("после блокировки даже верный пароль получает 429", async () => {
  const limiter = createLoginLimiter();
  for (let i = 0; i < 10; i += 1) await attemptLogin({ readPassword: slowBody("x"), key: "k", expected: "secret", limiter });
  const result = await attemptLogin({ readPassword: slowBody("secret"), key: "k", expected: "secret", limiter });
  assert.equal(result.status, 429);
  assert.ok(result.status === 429 && result.retryAfter > 0);
});

test("верный пароль — 200 и сброс счётчика ключа; битое тело — 400 без учёта попытки", async () => {
  const limiter = createLoginLimiter();
  for (let i = 0; i < 9; i += 1) await attemptLogin({ readPassword: slowBody("x"), key: "k", expected: "secret", limiter });
  assert.equal((await attemptLogin({ readPassword: slowBody("secret"), key: "k", expected: "secret", limiter })).status, 200);
  const broken = await attemptLogin({ readPassword: () => Promise.reject(new SyntaxError("bad json")), key: "k", expected: "secret", limiter });
  assert.equal(broken.status, 400);
  for (let i = 0; i < 10; i += 1) {
    assert.equal((await attemptLogin({ readPassword: slowBody("x"), key: "k", expected: "secret", limiter })).status, 401);
  }
});

test("ключ лимита: без ADMIN_TRUST_PROXY заголовки игнорируются", () => {
  const spoofed = headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" });
  assert.equal(rateLimitKey(spoofed, {}), "direct");
  assert.equal(rateLimitKey(spoofed, { ADMIN_TRUST_PROXY: "true" }), "direct");
  assert.equal(rateLimitKey(headers({ "x-real-ip": "9.9.9.9" }), {}), rateLimitKey(headers({ "x-real-ip": "8.8.8.8" }), {}));
});

test("ключ лимита: за прокси — X-Real-IP, иначе последний адрес X-Forwarded-For", () => {
  const env = { ADMIN_TRUST_PROXY: "1" };
  assert.equal(rateLimitKey(headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }), env), "ip:1.1.1.1");
  assert.equal(rateLimitKey(headers({ "x-forwarded-for": "6.6.6.6, 3.3.3.3" }), env), "ip:3.3.3.3");
  assert.equal(rateLimitKey(headers({}), env), "direct");
});

test("подмена заголовков без доверия к прокси не обходит лимит", async () => {
  const limiter = createLoginLimiter();
  const statuses: number[] = [];
  for (let i = 0; i < 12; i += 1) {
    const key = rateLimitKey(headers({ "x-real-ip": `10.0.0.${i}` }), {});
    statuses.push((await attemptLogin({ readPassword: slowBody("x"), key, expected: "secret", limiter })).status);
  }
  assert.deepEqual(statuses.slice(10), [429, 429]);
});
