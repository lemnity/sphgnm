import assert from "node:assert/strict";
import { test } from "node:test";
import { attemptLogin } from "./login.ts";
import {
  ADMIN_LANGS,
  MESSAGES,
  codeOf,
  formatDateTime,
  formatSize,
  langCookie,
  langFromAcceptLanguage,
  paramsOf,
  pickLang,
  translate,
  type MessageKey,
} from "./i18n.ts";
import { createLoginLimiter } from "./rate-limit.ts";
import { resolveSessionSecret } from "./session.ts";
import { ConflictError, StorageError, parseVersions, readHistory, resolveUploadPath, saveUpload } from "./storage.ts";

const keys = Object.keys(MESSAGES.ru) as MessageKey[];

test("словарь: каждый ключ есть на обоих языках, без лишних", () => {
  for (const lang of ADMIN_LANGS) assert.deepEqual(Object.keys(MESSAGES[lang]).sort(), [...keys].sort(), lang);
});

test("словарь: одинаковые параметры в переводах, тексты не пустые", () => {
  for (const key of keys) {
    assert.ok(MESSAGES.ru[key].trim() && MESSAGES.en[key].trim(), `${key}: пустой текст`);
    assert.deepEqual(paramsOf(MESSAGES.en[key]), paramsOf(MESSAGES.ru[key]), `${key}: разные параметры`);
  }
});

test("словарь: в английском нет кириллицы, перевод не копия русского", () => {
  for (const key of keys) {
    assert.doesNotMatch(MESSAGES.en[key], /[а-яё]/i, key);
    if (/[а-яё]/i.test(MESSAGES.ru[key])) assert.notEqual(MESSAGES.en[key], MESSAGES.ru[key], key);
  }
});

test("translate: подстановка параметров, неизвестный остаётся как есть", () => {
  assert.equal(translate("ru", "api.tooManyAttempts", { minutes: 15 }), "Слишком много попыток. Попробуйте через 15 мин.");
  assert.equal(translate("en", "api.tooManyAttempts", { minutes: 15 }), "Too many attempts. Try again in 15 min.");
  assert.equal(translate("en", "net.serverError"), "Server error ({status})");
  assert.equal(codeOf("api.wrongPassword"), "wrongPassword");
});

test("язык запроса: заголовок → cookie → Accept-Language → ru", () => {
  assert.equal(pickLang({}), "ru");
  assert.equal(pickLang({ acceptLanguage: "en-US,en;q=0.9" }), "en");
  assert.equal(pickLang({ acceptLanguage: "de-DE,de;q=0.9,ru;q=0.8,en;q=0.7" }), "ru");
  assert.equal(pickLang({ acceptLanguage: "ru;q=0.5,en;q=0.9" }), "en");
  assert.equal(pickLang({ acceptLanguage: "fr" }), "ru");
  assert.equal(pickLang({ cookie: "en", acceptLanguage: "ru" }), "en");
  assert.equal(pickLang({ cookie: "xx", acceptLanguage: "en" }), "en");
  assert.equal(pickLang({ header: "ru", cookie: "en" }), "ru");
  assert.equal(langFromAcceptLanguage("en;q=0"), null);
  assert.equal(langCookie("en"), "sph_admin_lang=en; Path=/; Max-Age=31536000; SameSite=Lax");
});

test("форматы: размер и дата по языку", () => {
  assert.equal(formatSize(2048), "2 КБ");
  assert.equal(formatSize(2048, "en"), "2 KB");
  assert.equal(formatSize(1.5 * 1024 * 1024), "1,5 МБ");
  assert.equal(formatSize(1.5 * 1024 * 1024, "en"), "1.5 MB");
  assert.match(formatDateTime("2026-10-08T12:34:00Z"), /октября 2026/);
  assert.match(formatDateTime("2026-10-08T12:34:00Z", "en"), /October 2026/);
});

test("ошибки хранилища: по-русски по умолчанию, по-английски через messageIn, code стабильный", async () => {
  const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");
  await assert.rejects(saveUpload("/nonexistent", { name: "x.svg", type: "image/svg+xml", bytes: svg }), (error: unknown) => {
    assert.ok(error instanceof StorageError);
    assert.equal(error.message, "SVG загружать нельзя: в нём может быть исполняемый код");
    assert.equal(error.messageIn("en"), "SVG files can't be uploaded: they may contain executable code");
    assert.equal(error.code, "svgForbidden");
    return true;
  });
  const big = new Uint8Array(16 * 1024 * 1024);
  big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  await assert.rejects(saveUpload("/nonexistent", { name: "big.png", type: "image/png", bytes: big }), (error: unknown) => {
    assert.ok(error instanceof StorageError);
    assert.equal(error.messageIn("en"), "The file is too large: images can be up to 15 MB");
    return true;
  });
  await assert.rejects(saveUpload("/nonexistent", { name: "a.txt", type: "text/plain", bytes: new TextEncoder().encode("hello, plain text") }), (error: unknown) => {
    assert.ok(error instanceof StorageError);
    assert.equal(error.messageIn("en"), "Unsupported file type. Allowed: jpg, png, webp, avif, gif, mp4, webm");
    assert.equal(error.message, "Неподдерживаемый тип файла. Можно: jpg, png, webp, avif, gif, mp4, webm");
    return true;
  });
  assert.throws(() => resolveUploadPath("/x", "../etc/passwd"), (error: unknown) => error instanceof StorageError && error.messageIn("en") === "Invalid file path");
  await assert.rejects(readHistory("/x", "nope"), (error: unknown) => error instanceof StorageError && error.messageIn("en") === "Unknown version");
  const conflict = new ConflictError(["site"]);
  assert.equal(conflict.messageIn("en"), "The site was changed in another tab or on another device");
  assert.equal(conflict.code, "conflict");
  assert.equal(parseVersions({}, ["site"], "en"), "No version given for section site: reload the admin page");
});

test("вход: тексты отказов по-английски", async () => {
  const limiter = createLoginLimiter(2, 50);
  const wrong = await attemptLogin({ readPassword: async () => "x", key: "k", expected: "secret", limiter, lang: "en" });
  assert.deepEqual(wrong, { status: 401, error: "Incorrect password", code: "wrongPassword" });
  const broken = await attemptLogin({ readPassword: () => Promise.reject(new Error("bad")), key: "j", expected: "secret", limiter, lang: "en" });
  assert.deepEqual(broken, { status: 400, error: "Expected { password }", code: "expectedPassword" });
  await attemptLogin({ readPassword: async () => "x", key: "k", expected: "secret", limiter, lang: "en" });
  const blocked = await attemptLogin({ readPassword: async () => "x", key: "k", expected: "secret", limiter, lang: "en" });
  assert.ok(blocked.status === 429);
  assert.equal(blocked.error, "Too many attempts. Try again in 15 min.");
  // По умолчанию — по-русски, как раньше.
  const ru = await attemptLogin({ readPassword: async () => "x", key: "m", expected: "secret", limiter: createLoginLimiter() });
  assert.ok(ru.status === 401 && ru.error === "Неверный пароль");
});

test("секрет сессии: ошибка конфигурации по-английски", () => {
  const short = resolveSessionSecret({ NODE_ENV: "production", ADMIN_SESSION_SECRET: "short" }, "en");
  assert.ok("error" in short && short.error.startsWith("ADMIN_SESSION_SECRET is shorter than 32 characters"));
  const missing = resolveSessionSecret({ NODE_ENV: "production" }, "en");
  assert.ok("error" in missing && missing.key === "api.secretMissing" && /isn't set/.test(missing.error));
});
