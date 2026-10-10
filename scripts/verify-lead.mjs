// Сквозная проверка формы заявки: отправка в браузере → письмо в заглушке sendmail.
//
// По умолчанию скрипт сам поднимает `next dev` (порт PORT, по умолчанию 3310) с
// SENDMAIL_PATH=scripts/sendmail-capture.sh и LEAD_AUTOREPLY=1, проверяет и гасит его:
//   npm run verify:lead
// Другой dev-сервер этого же каталога при этом должен быть остановлен (общая папка .next).
//
// Против уже запущенного сервера — передайте URL; сервер должен быть запущен с заглушкой
// и тем же каталогом писем:
//   SENDMAIL_PATH=scripts/sendmail-capture.sh LEAD_CAPTURE_DIR=/tmp/lead-capture LEAD_TO=team@example.com npx next dev -p 3300
//   URL=http://127.0.0.1:3300/ LEAD_CAPTURE_DIR=/tmp/lead-capture npm run verify:lead
//
// Лимит — 5 заявок за 10 минут: скрипт отправляет одну, частые повторы упрутся в 429.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const captureDir = process.env.LEAD_CAPTURE_DIR ?? path.join(tmpdir(), "sphagnum-lead-capture");
const leadTo = "verify-team@example.com";
const ownServer = !process.env.URL;
const port = process.env.PORT ?? "3310";
const baseUrl = new URL(process.env.URL ?? `http://127.0.0.1:${port}/`);
const at = (route) => new URL(route.replace(/^\//, ""), baseUrl).href;

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

/** Заголовки и раскодированные части письма. */
function parseMail(raw) {
  const [head, ...rest] = raw.split("\n\n");
  const headers = Object.fromEntries(
    head
      .replace(/\n /g, " ")
      .split("\n")
      .map((line) => [line.slice(0, line.indexOf(":")).toLowerCase(), line.slice(line.indexOf(":") + 1).trim()]),
  );
  const boundary = /boundary="([^"]+)"/.exec(headers["content-type"] ?? "")?.[1];
  const parts = (boundary ? rest.join("\n\n").split(`--${boundary}`).slice(1, -1) : []).map((chunk) => {
    const [partHead, body] = chunk.replace(/^\n/, "").split("\n\n");
    return { type: /Content-Type: ([^;\n]+)/.exec(partHead)?.[1], content: Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8") };
  });
  return { headers, parts };
}

const listMails = async () => (existsSync(captureDir) ? (await readdir(captureDir)).filter((name) => name.endsWith(".eml")) : []);

async function waitForServer(url, timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`сервер ${url} не поднялся`);
}

await mkdir(captureDir, { recursive: true });
let server;
if (ownServer) {
  server = spawn(path.join(root, "node_modules/.bin/next"), ["dev", "-p", port], {
    cwd: root,
    env: {
      ...process.env,
      SENDMAIL_PATH: path.join(root, "scripts/sendmail-capture.sh"),
      LEAD_CAPTURE_DIR: captureDir,
      LEAD_TO: leadTo,
      LEAD_AUTOREPLY: "1",
    },
    stdio: ["ignore", "ignore", "inherit"],
    detached: true,
  });
}

const browser = await chromium.launch({ headless: true });
const stamp = Date.now().toString(36);
const values = {
  name: `Проверка Формы ${stamp}, Acme`,
  email: `lead-${stamp}@example.com`,
  phone: "+971 50 000 0000",
  region: "Dubai, UAE",
  area: "1200",
  message: `Нужен субстрат <b>${stamp}</b>\nвторая строка`,
};

try {
  if (ownServer) await waitForServer(at("/"), 180_000);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(60_000);

  await step("API: GET — 405, битый JSON — 400, большое тело — 413", async () => {
    const request = page.context().request;
    invariant((await request.get(at("/api/lead"))).status() === 405, "GET не 405");
    const bad = await request.post(at("/api/lead"), { headers: { "content-type": "application/json" }, data: "{oops" });
    invariant(bad.status() === 400 && (await bad.json()).code === "invalidRequest", `битый JSON: ${bad.status()}`);
    const big = await request.post(at("/api/lead"), { headers: { "content-type": "application/json" }, data: JSON.stringify({ message: "x".repeat(40_000) }) });
    invariant(big.status() === 413 && (await big.json()).code === "tooLarge", `большое тело: ${big.status()}`);
  });

  const before = new Set(await listMails());
  await step("форма: отправка → «отправлено»", async () => {
    await page.goto(at("/"), { waitUntil: "domcontentloaded", timeout: 180_000 });
    const form = page.locator('form[aria-label]').filter({ has: page.locator('input[name="email"]') });
    await form.scrollIntoViewIfNeeded();
    await form.locator('input[name="name"]').fill(values.name);
    await form.locator('input[name="email"]').fill(values.email);
    await form.locator('input[name="phone"]').fill(values.phone);
    await form.locator('input[name="region"]').fill(values.region);
    await form.locator('select[name="projectType"]').selectOption({ index: 1 });
    await form.locator('input[name="area"]').fill(values.area);
    await form.locator('textarea[name="message"]').fill(values.message);
    await form.locator('button[type="submit"]').click();
    await form.locator('[data-form-status="success"]').waitFor();
    invariant((await form.locator('input[name="name"]').inputValue()) === "", "после успеха форма не очистилась");
  });

  await step("письмо команде: значения формы, text/plain и text/html", async () => {
    let fresh = [];
    for (let i = 0; i < 50 && fresh.length < (ownServer ? 2 : 1); i++) {
      fresh = (await listMails()).filter((name) => !before.has(name));
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const mails = await Promise.all(fresh.map(async (name) => parseMail(await readFile(path.join(captureDir, name), "utf8"))));
    const team = mails.find((mail) => mail.headers["reply-to"]?.includes(values.email));
    invariant(team, `нет письма с Reply-To ${values.email} (новых писем: ${mails.length})`);
    if (ownServer) invariant(team.headers.to === leadTo, `To: ${team.headers.to}`);
    invariant(team.parts.map((part) => part.type).join(",") === "text/plain,text/html", `части: ${team.parts.map((part) => part.type)}`);
    const [text, html] = team.parts.map((part) => part.content);
    for (const value of [values.name, values.email, values.phone, values.region, values.area]) {
      invariant(text.includes(value), `в тексте нет «${value}»`);
      invariant(html.includes(value), `в HTML нет «${value}»`);
    }
    invariant(text.includes(values.message.replace("\n", "\r\n")), "в тексте нет сообщения");
    invariant(html.includes(`&lt;b&gt;${stamp}&lt;/b&gt;`) && !html.includes(`<b>${stamp}`), "сообщение в HTML не экранировано");
    invariant(!/\{\{/.test(html), "в HTML остались {{подстановки}}");
    if (ownServer) {
      const reply = mails.find((mail) => mail.headers.to?.includes(values.email));
      invariant(reply && reply.headers["auto-submitted"] === "auto-replied", "нет автоответа клиенту");
      invariant(reply.parts.length === 2, "в автоответе не две части");
    }
  });

  await step("ошибка отправки: текст и почта для связи", async () => {
    // Как в статической сборке: API нет.
    await page.route("**/api/lead", (route) => route.fulfill({ status: 404, body: "Not found" }));
    await page.reload({ waitUntil: "domcontentloaded" });
    const form = page.locator('form[aria-label]').filter({ has: page.locator('input[name="email"]') });
    await form.scrollIntoViewIfNeeded();
    await form.locator('input[name="name"]').fill("Error Case");
    await form.locator('input[name="email"]').fill("error@example.com");
    await form.locator('button[type="submit"]').click();
    const alert = form.locator('[data-form-status="error"] [role="alert"]');
    await alert.waitFor();
    invariant((await alert.locator('a[href^="mailto:"]').count()) === 1, "нет ссылки на почту");
    invariant(await form.locator('button[type="submit"]').isEnabled(), "кнопка осталась неактивной");
  });
} finally {
  await browser.close();
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
  }
}

if (failed) process.exit(1);
console.log("verify:lead PASS");
