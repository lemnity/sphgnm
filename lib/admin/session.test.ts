import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_TTL_MS,
  checkPassword,
  createSessionToken,
  resolveSessionSecret,
  sessionCookieOptions,
  verifySessionToken,
} from "./session.ts";

const SECRET = "test-secret-0123456789";

test("подписанный токен проходит проверку", () => {
  const now = 1_700_000_000_000;
  const token = createSessionToken(SECRET, now);
  assert.equal(verifySessionToken(token, SECRET, now + 1000), true);
});

test("подделка: другой секрет, изменённый срок, мусор", () => {
  const now = 1_700_000_000_000;
  const token = createSessionToken(SECRET, now);
  assert.equal(verifySessionToken(token, "другой-секрет", now), false);

  const [, salt, signature] = token.split(".");
  const extended = `${now + SESSION_TTL_MS * 10}.${salt}.${signature}`;
  assert.equal(verifySessionToken(extended, SECRET, now), false);

  for (const junk of ["", "abc", "1.2", "1.2.3.4", `x.${salt}.${signature}`, undefined, null]) {
    assert.equal(verifySessionToken(junk, SECRET, now), false, String(junk));
  }
});

test("истёкший токен отклоняется", () => {
  const now = 1_700_000_000_000;
  const token = createSessionToken(SECRET, now);
  assert.equal(verifySessionToken(token, SECRET, now + SESSION_TTL_MS - 1), true);
  assert.equal(verifySessionToken(token, SECRET, now + SESSION_TTL_MS), false);
});

test("пустой секрет никогда не даёт сессию", () => {
  const token = createSessionToken("", 0);
  assert.equal(verifySessionToken(token, "", 0), false);
});

test("checkPassword", () => {
  assert.equal(checkPassword("пароль", "пароль"), true);
  assert.equal(checkPassword("пароль1", "пароль"), false);
  assert.equal(checkPassword("", ""), false);
});

test("секрет: из env, временный в dev, отказ в production", () => {
  const long = "x".repeat(32);
  assert.deepEqual(resolveSessionSecret({ ADMIN_SESSION_SECRET: ` ${long} ` }), { secret: long });
  assert.deepEqual(resolveSessionSecret({ ADMIN_SESSION_SECRET: long, NODE_ENV: "production" }), { secret: long });

  const warn = console.warn;
  console.warn = () => {};
  try {
    const first = resolveSessionSecret({ NODE_ENV: "development" });
    const second = resolveSessionSecret({ NODE_ENV: "development" });
    assert.ok("secret" in first && first.secret.length >= 32);
    assert.deepEqual(first, second, "временный секрет один на процесс");
  } finally {
    console.warn = warn;
  }

  const prod = resolveSessionSecret({ NODE_ENV: "production" });
  assert.ok("error" in prod && prod.error.includes("ADMIN_SESSION_SECRET"));
});

test("cookie: httpOnly, strict, secure только в production", () => {
  const dev = sessionCookieOptions({ NODE_ENV: "development" });
  assert.equal(dev.httpOnly, true);
  assert.equal(dev.sameSite, "strict");
  assert.equal(dev.secure, false);
  assert.equal(dev.maxAge, 7 * 24 * 60 * 60);
  assert.equal(sessionCookieOptions({ NODE_ENV: "production" }).secure, true);
  assert.equal(sessionCookieOptions({ NODE_ENV: "production", ADMIN_COOKIE_SECURE: "false" }).secure, false);
  // Выключает только точное "false": опечатки и прочие значения оставляют Secure.
  for (const value of ["0", "no", "False", "FALSE", " false", "off", "true", ""]) {
    assert.equal(sessionCookieOptions({ NODE_ENV: "production", ADMIN_COOKIE_SECURE: value }).secure, true, value);
  }
  assert.equal(sessionCookieOptions({ NODE_ENV: "development", ADMIN_COOKIE_SECURE: "true" }).secure, false);
});

test("короткий секрет: в production вход отключён, в dev — предупреждение", () => {
  const short = "short-secret-31-chars-xxxxxxxxx";
  assert.equal(short.length, 31);
  const prod = resolveSessionSecret({ ADMIN_SESSION_SECRET: short, NODE_ENV: "production" });
  assert.ok("error" in prod && /короче 32/.test(prod.error));

  const warnings: unknown[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    assert.deepEqual(resolveSessionSecret({ ADMIN_SESSION_SECRET: short, NODE_ENV: "development" }), { secret: short });
    resolveSessionSecret({ ADMIN_SESSION_SECRET: short, NODE_ENV: "development" });
  } finally {
    console.warn = warn;
  }
  assert.equal(warnings.length, 1, "предупреждение один раз на процесс");
});
