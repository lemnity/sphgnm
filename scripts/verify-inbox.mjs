// Сквозная проверка «Входящих» кабинета: заявки (сохранение, «прочитано», CSV, удаление)
// и почта (Maildir только для чтения, HTML в песочнице, картинки по кнопке, вложения).
//
// По умолчанию скрипт сам поднимает `next dev` (порт PORT, по умолчанию 3320) с заглушкой
// sendmail и MAILDIR_PATH во временной папке, проверяет и гасит его:
//   npm run verify:inbox
// Другой dev-сервер этого же каталога при этом должен быть остановлен (общая папка .next).
//
// Против уже запущенного сервера — URL и тот же MAILDIR_PATH, что у сервера. Папки по этому
// пути быть не должно: скрипт сам создаёт в ней Maildir из lib/mail/fixtures и потом удаляет.
//   MAILDIR_PATH=/tmp/sph-maildir SENDMAIL_PATH=scripts/sendmail-capture.sh LEAD_TO=team@example.com npx next dev -p 3400
//   URL=http://127.0.0.1:3400/ MAILDIR_PATH=/tmp/sph-maildir npm run verify:inbox
// Пароль — ADMIN_PASSWORD (npm-скрипт подхватывает .env.local).
// Скрипт удаляет созданные им заявки, Maildir и возвращает data/mail-state.json как был.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error("Задайте ADMIN_PASSWORD (в .env.local или в окружении).");
  process.exit(1);
}
const ownServer = !process.env.URL;
if (!ownServer && !process.env.MAILDIR_PATH) {
  console.error("С URL нужен MAILDIR_PATH — тот же, с которым запущен сервер.");
  process.exit(1);
}
const port = process.env.PORT ?? "3320";
const baseUrl = new URL(process.env.URL ?? `http://127.0.0.1:${port}/`);
const at = (route) => new URL(route.replace(/^\//, ""), baseUrl).href;
const stamp = Date.now().toString(36);
const maildir = process.env.MAILDIR_PATH ?? path.join(tmpdir(), `sph-verify-maildir-${stamp}`);
const captureDir = process.env.LEAD_CAPTURE_DIR ?? path.join(tmpdir(), `sph-verify-capture-${stamp}`);
const leadsDir = path.resolve(root, process.env.LEADS_DIR ?? "data/leads");
const dataDir = path.join(root, "data");
const stateFile = path.join(dataDir, "mail-state.json");
const fixtures = path.join(root, "lib/mail/fixtures");

if (existsSync(maildir)) {
  console.error(`${maildir} уже есть — нужен путь, которого нет: скрипт создаст Maildir сам и удалит его.`);
  process.exit(1);
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

let failed = false;
let page;
async function step(name, run) {
  if (failed) return;
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed = true;
    if (process.env.DEBUG_SHOT && page) await page.screenshot({ path: process.env.DEBUG_SHOT, fullPage: true }).catch(() => {});
    console.error(`FAIL ${name}\n  ${error instanceof Error ? error.message : error}`);
  }
}

async function waitForServer(url, timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`сервер ${url} не поднялся`);
}

const list = async (dir) => (existsSync(dir) ? new Set(await readdir(dir)) : new Set());
const before = {
  data: existsSync(dataDir),
  leads: await list(leadsDir),
  leadsDir: existsSync(leadsDir),
  state: existsSync(stateFile) ? await readFile(stateFile, "utf8") : null,
};

/** Maildir из фикстур в раскладке Dovecot: .INBOX/{new,cur} и .Sent/cur. */
const MAILDIR = [
  [".INBOX/new", "1791700000.M1P1.verify,S=501", "encoded-headers.eml"],
  [".INBOX/cur", "1791600000.M2P1.verify,S=1174:2,", "alternative.eml"],
  [".INBOX/cur", "1791500000.M3P1.verify,S=1080:2,S", "nested-mixed.eml"],
  [".Sent/cur", "1791300000.M5P1.verify:2,S", "latin1.eml"],
];
async function makeMaildir() {
  for (const sub of ["new", "cur", "tmp"]) await mkdir(path.join(maildir, sub), { recursive: true });
  for (const [dir, name, fixture] of MAILDIR) {
    await mkdir(path.join(maildir, dir), { recursive: true });
    await copyFile(path.join(fixtures, fixture), path.join(maildir, dir, name));
  }
}
/** Имена и время изменения всех файлов Maildir — чтобы убедиться, что кабинет ничего не трогал. */
async function snapshotMaildir() {
  const out = [];
  const walk = async (dir) => {
    for (const dirent of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, dirent.name);
      if (dirent.isDirectory()) await walk(full);
      else out.push(`${path.relative(maildir, full)}@${(await stat(full)).mtimeMs}`);
    }
  };
  await walk(maildir);
  return out.sort().join("\n");
}

let server;
if (ownServer) {
  server = spawn(path.join(root, "node_modules/.bin/next"), ["dev", "-p", port], {
    cwd: root,
    env: {
      ...process.env,
      SENDMAIL_PATH: path.join(root, "scripts/sendmail-capture.sh"),
      LEAD_CAPTURE_DIR: captureDir,
      LEAD_TO: "verify-team@example.com",
      MAILDIR_PATH: maildir,
    },
    stdio: ["ignore", "ignore", "inherit"],
    detached: true,
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
page = await context.newPage();
page.setDefaultTimeout(30_000);
const toast = (text) => page.locator(".adm-toast", { hasText: text }).first();
const nav = () => page.getByRole("navigation", { name: "Разделы сайта" });
const sideItem = (name) => nav().getByRole("button", { name, exact: false }).first();

/** Запрос из страницы: cookie сессии SameSite=Strict, сторонний клиент её не отправит. */
const call = (url, init = {}) =>
  page.evaluate(
    async ([url, init]) => {
      const response = await fetch(url, { ...init, cache: "no-store" });
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        head: Array.from(bytes.slice(0, 3)),
        text: new TextDecoder().decode(bytes),
      };
    },
    [url, init],
  );

const lead = {
  name: `Инбокс Проверка ${stamp}`,
  email: `inbox-${stamp}@example.com`,
  phone: "+971 50 111 2233",
  region: "Abu Dhabi",
  area: "640",
  message: `Проверка входящих ${stamp}\nвторая строка`,
};
let leadId = "";
const leadFile = () => path.join(leadsDir, `${leadId}.json`);
const readLead = async () => JSON.parse(await readFile(leadFile(), "utf8"));

// Счётчик запросов к картинке-трекеру из письма: до кнопки их быть не должно.
let trackerHits = 0;

try {
  if (ownServer) await waitForServer(at("/"), 180_000);
  await page.route("https://tracker.example/**", (route) => {
    trackerHits++;
    return route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAAAAACw=", "base64") });
  });

  await step("API входящих закрыт без входа", async () => {
    const anonymous = await browser.newContext();
    for (const route of ["/api/admin/leads", "/api/admin/leads/csv", "/api/admin/mail", "/api/admin/mail/message?id=x", "/api/admin/mail/attachment?id=x&index=0"]) {
      const response = await anonymous.request.get(at(route));
      invariant(response.status() === 401, `${route}: ${response.status()} вместо 401`);
    }
    await anonymous.close();
  });

  await step("вход в кабинет", async () => {
    await page.goto(at("/admin/login"), { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("form[data-ready]").waitFor({ timeout: 120_000 });
    await page.getByLabel("Пароль").fill(password);
    await page.getByRole("button", { name: "Войти" }).click();
    await page.waitForURL((url) => url.pathname === "/admin", { timeout: 120_000 });
    await page.getByRole("heading", { name: "Первый экран" }).waitFor({ timeout: 120_000 });
  });

  await step("почта без Maildir: спокойное «не подключена»", async () => {
    await sideItem("Почта").click();
    await page.getByRole("heading", { name: /^Почта/ }).waitFor();
    await page.locator('[data-mail="not-connected"]').filter({ hasText: "Почта на этом сервере не подключена" }).waitFor();
    invariant((await page.locator(".adm-error-text").count()) === 0, "вместо спокойного состояния — ошибка");
  });

  await step("заявка через API сохраняется до письма, статус письма — sent", async () => {
    const response = await context.request.post(at("/api/lead"), { headers: { "content-type": "application/json" }, data: JSON.stringify({ ...lead, projectType: "" }) });
    invariant(response.status() === 200, `POST /api/lead: ${response.status()} ${await response.text()}`);
    const fresh = [...(await list(leadsDir))].filter((name) => !before.leads.has(name));
    invariant(fresh.length === 1, `новых файлов заявок: ${fresh.length}`);
    leadId = fresh[0].replace(/\.json$/, "");
    const saved = await readLead();
    invariant(saved.name === lead.name && saved.email === lead.email && saved.message === lead.message, `в файле: ${JSON.stringify(saved)}`);
    invariant(saved.mailStatus === "sent" && saved.read === false, `статус ${saved.mailStatus}, read ${saved.read}`);
    invariant(!Number.isNaN(Date.parse(saved.submittedAt)), "нет submittedAt");
  });

  await step("«Заявки»: значок непрочитанных, заявка в списке", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Первый экран" }).waitFor({ timeout: 120_000 });
    const badge = nav().locator(".adm-side__unread").first();
    await badge.waitFor();
    invariant(Number(await badge.textContent()) >= 1, `значок: ${await badge.textContent()}`);
    await sideItem("Заявки").click();
    await page.getByRole("heading", { name: /^Заявки/ }).waitFor();
    const row = page.locator(".adm-inbox__row", { hasText: lead.name });
    await row.waitFor();
    invariant(await row.evaluate((node) => node.classList.contains("adm-inbox__row--unread")), "строка не отмечена непрочитанной");
  });

  await step("открытие заявки: все поля, без ссылок, становится прочитанной", async () => {
    await page.locator(".adm-inbox__row", { hasText: lead.name }).click();
    const card = page.locator(".adm-lead-card");
    await card.getByRole("heading", { name: `Заявка № ${leadId}` }).waitFor();
    for (const value of [lead.name, lead.email, lead.phone, lead.region, lead.area]) await card.getByText(value, { exact: true }).waitFor();
    await card.locator('[data-field="message"]').filter({ hasText: "вторая строка" }).waitFor();
    invariant((await card.locator("a").count()) === 0, "в карточке заявки есть ссылки");
    invariant((await page.locator('.adm-inbox a[href^="mailto:"], .adm-inbox a[href^="tel:"]').count()) === 0, "есть mailto:/tel:");
    await card.getByText("Уведомление команде отправлено").waitFor();
    for (let i = 0; i < 50 && !(await readLead()).read; i++) await new Promise((resolve) => setTimeout(resolve, 100));
    invariant((await readLead()).read === true, "заявка не стала прочитанной");
  });

  await step("«Отметить непрочитанной» и поиск", async () => {
    await page.getByRole("button", { name: "Отметить непрочитанной" }).click();
    await toast("непрочитанной").waitFor();
    invariant((await readLead()).read === false, "отметка не записалась");
    const search = page.getByRole("searchbox", { name: "Поиск по заявкам" });
    await search.fill(stamp);
    await page.locator(".adm-inbox__row").first().waitFor();
    invariant((await page.locator(".adm-inbox__row").count()) === 1, "поиск по метке нашёл не одну заявку");
    await search.fill(`нет-такого-${stamp}`);
    await page.getByText(`По запросу «нет-такого-${stamp}» ничего не найдено.`).waitFor();
    await search.fill("");
  });

  await step("CSV: UTF-8 с BOM, вложение, все заявки", async () => {
    const csv = await call("/api/admin/leads/csv");
    invariant(csv.status === 200, `CSV: ${csv.status}`);
    invariant(csv.head.join(",") === "239,187,191", `нет BOM: ${csv.head}`);
    invariant(/^attachment; filename="leads-\d{4}-\d{2}-\d{2}\.csv"$/.test(csv.headers["content-disposition"] ?? ""), csv.headers["content-disposition"]);
    invariant(csv.headers["content-type"]?.startsWith("text/csv"), csv.headers["content-type"]);
    invariant(csv.text.includes("Номер,Дата (Дубай),Имя и компания,Почта"), "нет русской шапки");
    invariant(csv.text.includes(leadId) && csv.text.includes(lead.email) && csv.text.includes("'+971 50 111 2233"), "в CSV нет заявки");
    invariant(csv.text.includes("\r\n"), "строки не через CRLF");
    const link = page.getByRole("link", { name: "Скачать CSV" });
    invariant((await link.getAttribute("href")) === "/api/admin/leads/csv", "ссылка на CSV");
  });

  await step("проверка номера: обход пути не проходит", async () => {
    for (const route of ["/api/admin/leads/..%2F..%2Fpackage", "/api/admin/leads/261010-AB2C.json", "/api/admin/leads/%2E%2E"]) {
      const response = await call(route);
      invariant(response.status === 400 || response.status === 404, `${route}: ${response.status}`);
    }
    const patch = await call(`/api/admin/leads/${leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: "yes" }) });
    invariant(patch.status === 400, `PATCH без boolean: ${patch.status}`);
  });

  await step("удаление заявки через окно подтверждения", async () => {
    await page.locator(".adm-inbox__row", { hasText: lead.name }).click();
    await page.locator(".adm-lead-card").getByRole("button", { name: "Удалить" }).click();
    const dialog = page.getByRole("dialog", { name: "Удалить заявку?" });
    await dialog.getByText(leadId).waitFor();
    await dialog.getByRole("button", { name: "Удалить" }).click();
    await toast("Заявка удалена").waitFor();
    invariant(!existsSync(leadFile()), "файл заявки остался");
    invariant((await page.locator(".adm-inbox__row", { hasText: lead.name }).count()) === 0, "заявка осталась в списке");
  });

  let maildirBefore = "";
  await step("почта: список писем, INBOX первой, папки только для чтения", async () => {
    await makeMaildir();
    maildirBefore = await snapshotMaildir();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Первый экран" }).waitFor({ timeout: 120_000 });
    // Значок непрочитанных рисует уже живой React: клик до гидрации потерялся бы.
    await nav().locator(".adm-side__unread").first().waitFor();
    await sideItem("Почта").click();
    const folders = page.getByRole("group", { name: "Папки" }).getByRole("button");
    await folders.first().waitFor();
    invariant((await folders.first().textContent())?.startsWith("Входящие"), `первая папка: ${await folders.first().textContent()}`);
    invariant((await folders.count()) === 2, `папок: ${await folders.count()}`);
    const rows = page.locator(".adm-mail__list tbody tr");
    await rows.first().waitFor();
    invariant((await rows.count()) === 3, `писем во входящих: ${await rows.count()}`);
    const subjects = await page.locator(".adm-mail__open").allTextContents();
    invariant(JSON.stringify(subjects) === JSON.stringify(["Заявка на субстрат — крыша", "Тест alternative", "Drawings attached"]), `темы: ${subjects}`);
    invariant((await page.locator(".adm-mail__unread").count()) === 2, "непрочитанных не 2");
    invariant((await rows.nth(2).locator(".adm-mail__clip").count()) === 1, "нет значка вложения");
    for (const name of ["Ответить", "Переслать", "Удалить", "Написать"]) {
      invariant((await page.locator(".adm-inbox").getByRole("button", { name }).count()) === 0, `в почте есть кнопка «${name}»`);
    }
    await folders.nth(1).click();
    await page.locator(".adm-mail__open", { hasText: "Résumé" }).waitFor();
    await folders.first().click();
    await page.locator(".adm-mail__open", { hasText: "Тест alternative" }).waitFor();
  });

  await step("письмо с HTML: текст по умолчанию, HTML в песочнице без скриптов, картинки по кнопке", async () => {
    const title = await page.title();
    await page.locator(".adm-mail__open", { hasText: "Тест alternative" }).click();
    await page.getByRole("heading", { name: "Тест alternative" }).waitFor();
    await page.locator(".adm-mail__text").filter({ hasText: "soft break right here and continues" }).waitFor();
    await page.getByRole("group", { name: "Вид письма" }).getByRole("button", { name: "HTML" }).click();
    const frame = page.locator("iframe.adm-mail__frame");
    await frame.waitFor();
    invariant((await frame.getAttribute("sandbox")) === "", `sandbox="${await frame.getAttribute("sandbox")}"`);
    const srcdoc = (await frame.getAttribute("srcdoc")) ?? "";
    invariant(srcdoc.indexOf("Content-Security-Policy") > 0 && srcdoc.indexOf("Content-Security-Policy") < srcdoc.indexOf("hello"), "CSP не в начале документа");
    invariant(srcdoc.includes("img-src data:;"), "картинки из сети не закрыты CSP");
    invariant(!/<script|onerror|onload|javascript:|<iframe|<form|refresh/i.test(srcdoc), "в srcdoc остался опасный HTML");
    const inner = page.frameLocator("iframe.adm-mail__frame");
    await inner.locator("#hello").filter({ hasText: "Hello roof team" }).waitFor();
    invariant((await inner.locator("script").count()) === 0, "в документе письма есть script");
    invariant((await inner.locator('a[href]').count()) === 0, "ссылки в письме кликабельны");
    await page.waitForTimeout(1000);
    invariant((await page.title()) === title && !(await page.title()).includes("HACKED"), "скрипт письма выполнился");
    invariant(trackerHits === 0, `картинка-трекер загрузилась до кнопки (${trackerHits})`);
    await page.getByText("Картинки из интернета скрыты").waitFor();
    await page.getByRole("button", { name: "Показать картинки" }).click();
    await page.getByText("Картинки из интернета показаны для этого письма.").waitFor();
    for (let i = 0; i < 50 && trackerHits === 0; i++) await page.waitForTimeout(100);
    invariant(trackerHits > 0, "после «Показать картинки» картинка не загрузилась");
    invariant(((await frame.getAttribute("srcdoc")) ?? "").includes("img-src data: https:;"), "CSP не расширена");
    invariant((await page.title()) === title, "скрипт письма выполнился после показа картинок");
  });

  await step("прочитанное — в data/mail-state.json, Maildir не изменён", async () => {
    const state = JSON.parse(await readFile(stateFile, "utf8"));
    invariant(state.read["1791600000.M2P1.verify,S=1174"] === true, `mail-state: ${JSON.stringify(state)}`);
    invariant((await snapshotMaildir()) === maildirBefore, "файлы Maildir изменились");
  });

  await step("вложения: список и скачивание только как файл", async () => {
    await page.getByRole("button", { name: "← К списку" }).click();
    await page.locator(".adm-mail__open", { hasText: "Drawings attached" }).click();
    await page.getByRole("heading", { name: "Вложения" }).waitFor();
    const links = page.locator(".adm-mail__files a");
    invariant((await links.count()) === 3, `вложений: ${await links.count()}`);
    invariant((await links.first().textContent())?.includes("Чертеж.pdf"), await links.first().textContent());
    const href = await links.first().getAttribute("href");
    const file = await call(href);
    invariant(file.status === 200, `вложение: ${file.status}`);
    invariant(file.headers["content-type"] === "application/octet-stream", file.headers["content-type"]);
    invariant(file.headers["x-content-type-options"] === "nosniff", "нет nosniff");
    invariant(/^attachment; filename="_+\.pdf"; filename\*=UTF-8''%D0%A7/.test(file.headers["content-disposition"] ?? ""), file.headers["content-disposition"]);
    invariant(file.text.startsWith("%PDF-1.4"), "содержимое вложения");
    for (const route of [
      "/api/admin/mail/message?folder=..&id=1791500000.M3P1.verify,S=1080",
      "/api/admin/mail/message?folder=INBOX&id=../../etc/passwd",
      "/api/admin/mail/attachment?folder=INBOX&id=1791500000.M3P1.verify,S=1080&index=9",
    ]) {
      const response = await call(route);
      invariant([400, 404].includes(response.status), `${route}: ${response.status}`);
    }
    invariant((await snapshotMaildir()) === maildirBefore, "файлы Maildir изменились");
  });

  await step("английский интерфейс входящих", async () => {
    await page.getByRole("group", { name: "Язык интерфейса" }).getByRole("button", { name: "English" }).click();
    const en = page.getByRole("navigation", { name: "Site sections" });
    await en.getByRole("button", { name: "Leads" }).waitFor();
    await en.getByRole("button", { name: "Mail" }).waitFor();
    await page.getByRole("button", { name: "Mark as unread" }).waitFor();
    await page.getByRole("group", { name: "Interface language" }).getByRole("button", { name: "Русский" }).click();
    await nav().getByRole("button", { name: "Заявки" }).waitFor();
  });
} finally {
  await browser.close();
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
  }
  // Убираем за собой: заявки этого прогона, Maildir, письма заглушки, отметки «прочитано».
  for (const name of await list(leadsDir)) if (!before.leads.has(name)) await rm(path.join(leadsDir, name), { force: true });
  if (!before.leadsDir && existsSync(leadsDir) && (await list(leadsDir)).size === 0) await rm(leadsDir, { recursive: true });
  if (before.state === null) await rm(stateFile, { force: true });
  else await writeFile(stateFile, before.state);
  if (!before.data && existsSync(dataDir) && (await list(dataDir)).size === 0) await rm(dataDir, { recursive: true });
  await rm(maildir, { recursive: true, force: true });
  if (!process.env.LEAD_CAPTURE_DIR) await rm(captureDir, { recursive: true, force: true });
}

if (failed) {
  console.error("\nПроверка входящих не прошла.");
  process.exit(1);
}
console.log("\nverify:inbox PASS");
