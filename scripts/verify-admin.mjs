// Сквозная проверка кабинета в браузере: вход, правка и сохранение, ошибка
// валидации, галерея, медиатека, откат через историю, выход.
// Запуск при работающем сервере: URL=http://127.0.0.1:3041/ npm run verify:admin
// Пароль — ADMIN_PASSWORD (npm-скрипт подхватывает .env.local).
// Скрипт сам возвращает content/*.json и удаляет загруженные им файлы и версии истории.
import { existsSync } from "node:fs";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = new URL(process.env.URL ?? "http://127.0.0.1:3000/");
const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error("Задайте ADMIN_PASSWORD (в .env.local или в окружении).");
  process.exit(1);
}

const at = (route) => new URL(route.replace(/^\//, ""), baseUrl).href;
const files = {
  site: path.join(root, "content/site.json"),
  gallery: path.join(root, "content/gallery.json"),
  uploads: path.join(root, "public/uploads"),
  history: path.join(root, "content/.history"),
};
const list = async (dir) => (existsSync(dir) ? new Set(await readdir(dir)) : new Set());
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

const original = { site: await readFile(files.site, "utf8"), gallery: await readFile(files.gallery, "utf8") };
const before = { uploads: await list(files.uploads), history: await list(files.history) };
const stamp = Date.now().toString(36);
const marker = `Проверка кабинета ${stamp}`;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

let failed = false;
async function step(name, run) {
  if (failed) return;
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}\n  ${error instanceof Error ? error.message : error}`);
  }
}

async function homeHtml(request) {
  const response = await request.get(at("/"));
  invariant(response.ok(), `главная ответила ${response.status()}`);
  return response.text();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(30_000);
const toast = (text) => page.locator(".adm-toast", { hasText: text }).first();
const status = page.locator(".adm-status");
const saveButton = page.getByRole("button", { name: "Сохранить", exact: true });
const sidebar = (name) => page.getByRole("navigation", { name: "Разделы сайта" }).getByRole("button", { name, exact: false }).first();
let uploaded = "";

// Ждём не тост (от прошлого сохранения он ещё может висеть), а смену статуса.
async function saveAndWait() {
  await saveButton.click();
  await status.filter({ hasText: "Все изменения сохранены" }).waitFor();
  invariant(await saveButton.isDisabled(), "после сохранения «Сохранить» должна стать неактивной");
}

try {
  await step("без входа /admin ведёт на страницу входа", async () => {
    await page.goto(at("/admin"), { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForURL(/\/admin\/login/);
    await page.locator("form[data-ready]").waitFor();
  });

  await step("неверный пароль — понятная ошибка", async () => {
    await page.getByLabel("Пароль").fill(`wrong-${stamp}`);
    await page.getByRole("button", { name: "Войти" }).click();
    await page.getByRole("alert").filter({ hasText: "Неверный пароль" }).waitFor();
  });

  await step("вход по паролю", async () => {
    await page.getByLabel("Пароль").fill(password);
    await page.getByRole("button", { name: "Войти" }).click();
    await page.waitForURL((url) => url.pathname === "/admin", { timeout: 120_000 });
    await page.getByRole("heading", { name: "Первый экран" }).waitFor({ timeout: 120_000 });
    invariant(await saveButton.isDisabled(), "без правок «Сохранить» должна быть неактивна");
  });

  await step("правка заголовка первого экрана и сохранение", async () => {
    await page.getByLabel("Заголовок", { exact: true }).fill(marker);
    await status.filter({ hasText: "Есть несохранённые изменения" }).waitFor();
    invariant(await saveButton.isEnabled(), "после правки «Сохранить» должна стать активной");
    await saveAndWait();
    await toast("Сохранено").waitFor();
    const site = await readJson(files.site);
    invariant(site.hero.title === marker, `в site.json заголовок «${site.hero.title}»`);
  });

  await step("изменение видно на главной", async () => {
    invariant((await homeHtml(context.request)).includes(marker), "на главной нет нового заголовка");
  });

  await step("ошибка валидации показывается у поля и в сводке", async () => {
    await sidebar("Полоса").click();
    const field = page.locator('[data-path="strip.intro.linkHref"]');
    const input = field.getByLabel("Куда ведёт ссылка");
    const previous = await input.inputValue();
    await input.fill("javascript:alert(1)");
    await saveButton.click();
    await page.locator("#adm-summary").waitFor();
    await field.locator(".adm-field__errors").filter({ hasText: "недопустимая ссылка" }).waitFor();
    invariant((await readJson(files.site)).strip.intro.linkHref === previous, "невалидная ссылка попала в файл");
    await input.fill(previous);
    await page.locator("#adm-summary").waitFor({ state: "detached" });
    await status.filter({ hasText: "Все изменения сохранены" }).waitFor();
  });

  await step("предупреждение при уходе с несохранёнными правками", async () => {
    await sidebar("Подвал").click();
    const input = page.getByLabel("Копирайт");
    const previous = await input.inputValue();
    await input.fill(`${previous} ${stamp}`);
    const blocked = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    invariant(blocked, "beforeunload не остановлен при несохранённых правках");
    await input.fill(previous);
    await status.filter({ hasText: "Все изменения сохранены" }).waitFor();
  });

  await step("галерея: загрузка картинки, подпись, сохранение", async () => {
    await sidebar("Галерея").click();
    const cards = page.locator(".adm-gcard");
    const count = await cards.count();
    await page.locator(".adm-gallery__upload input[type=file]").setInputFiles(path.join(root, "public/media/fuscum-wetland.webp"));
    await page.waitForFunction((expected) => document.querySelectorAll(".adm-gcard").length === expected, count + 1);
    const title = page.getByLabel("Подпись", { exact: true }).first();
    invariant((await title.inputValue()) === "fuscum wetland", `подпись по умолчанию «${await title.inputValue()}»`);
    await title.fill(`Тест ${stamp}`);
    await saveAndWait();
    const gallery = await readJson(files.gallery);
    invariant(gallery.length === count + 1, "элемент не попал в gallery.json");
    invariant(gallery[0].src.startsWith("uploads/") && gallery[0].type === "image" && gallery[0].title === `Тест ${stamp}`, JSON.stringify(gallery[0]));
    uploaded = gallery[0].src;
    invariant(existsSync(path.join(root, "public", uploaded)), "файла нет в public/uploads");
  });

  await step("галерея: удаление элемента", async () => {
    await page.getByRole("button", { name: "Элемент № 1: убрать из галереи" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Убрать" }).click();
    await saveAndWait();
    invariant(JSON.stringify(await readJson(files.gallery)) === JSON.stringify(JSON.parse(original.gallery)), "gallery.json не вернулся к исходному");
  });

  await step("медиатека: загруженный файл виден и удаляется", async () => {
    const name = uploaded.split("/").pop();
    await sidebar("Загруженные файлы").click();
    const dialog = page.getByRole("dialog", { name: "Загруженные файлы" });
    await dialog.getByText(name).waitFor();
    await dialog.getByRole("button", { name: `Удалить ${name}` }).click();
    await page.getByRole("dialog", { name: "Удалить файл?" }).getByRole("button", { name: "Удалить" }).click();
    await toast("Файл удалён").waitFor();
    invariant(!existsSync(path.join(root, "public", uploaded)), "файл остался на диске");
    await dialog.getByRole("button", { name: "Закрыть" }).click();
  });

  await step("откат через историю", async () => {
    await page.getByRole("button", { name: "История", exact: true }).click();
    const row = page.locator("tbody tr", { hasText: "Тексты и картинки" }).first();
    await row.getByRole("button", { name: /^Вернуть/ }).click();
    await page.getByRole("dialog", { name: "Вернуть эту версию?" }).getByRole("button", { name: "Вернуть" }).click();
    await toast("возвращена").waitFor();
    const site = await readJson(files.site);
    invariant(JSON.stringify(site) === JSON.stringify(JSON.parse(original.site)), "site.json не вернулся к исходному");
    invariant(!(await homeHtml(context.request)).includes(marker), "на главной остался тестовый заголовок");
  });

  await step("выход", async () => {
    await page.getByRole("button", { name: "Выйти" }).click();
    await page.waitForURL(/\/admin\/login/);
    await page.goto(at("/admin"));
    await page.waitForURL(/\/admin\/login/);
  });
} finally {
  await browser.close();
  // Контент — как был, загрузки и версии истории этого прогона — удалить.
  if ((await readFile(files.site, "utf8")) !== original.site) await writeFile(files.site, original.site);
  if ((await readFile(files.gallery, "utf8")) !== original.gallery) await writeFile(files.gallery, original.gallery);
  for (const [dir, known] of [
    [files.uploads, before.uploads],
    [files.history, before.history],
  ]) {
    for (const name of await list(dir)) if (!known.has(name)) await rm(path.join(dir, name), { force: true });
  }
  if (existsSync(files.uploads) && before.uploads.size === 0 && (await list(files.uploads)).size === 0) await rm(files.uploads, { recursive: true });
}

if (failed) {
  console.error("\nПроверка кабинета не прошла.");
  process.exit(1);
}
console.log("\nКабинет работает: все шаги прошли.");
