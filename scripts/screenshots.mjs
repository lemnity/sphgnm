/**
 * Снимает лендинг целиком и по секциям в ./screenshots.
 *
 * Playwright НЕ объявлен в зависимостях: он тянет ~300 МБ браузеров, а нужен
 * раз в несколько правок. Перед запуском:
 *   npm i -D playwright && npx playwright install chromium
 *
 * Затем, при поднятом `npm run dev`:
 *   node scripts/screenshots.mjs
 */
import { chromium } from "playwright";

const OUT = "screenshots";
const URL = process.env.URL ?? "http://localhost:3000/";

const b = await chromium.launch();
const errs = [];
const failedReq = [];

// ── Полностраничные снимки на трёх ширинах ──
for (const [n, w, h] of [["desktop", 1440, 900], ["tablet", 834, 1112], ["mobile", 390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on("pageerror", (e) => errs.push(`[${n}] ${e.message}`));
  p.on("requestfailed", (r) => failedReq.push(`[${n}] ${r.url().slice(0, 90)} — ${r.failure()?.errorText}`));
  p.on("response", (r) => {
    if (r.status() >= 400) failedReq.push(`[${n}] HTTP ${r.status()} ${r.url().slice(0, 90)}`);
  });
  await p.goto(URL, { waitUntil: "networkidle", timeout: 90000 });
  // Прокручиваем до конца: Reveal-блоки скрыты, пока не попали в кадр —
  // без прокрутки full-page снимок выйдет наполовину пустым.
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 55));
    }
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(1400);
  await p.screenshot({ path: `${OUT}/full-${n}.png`, fullPage: true });

  const overflow = await p.evaluate(() => {
    let m = 0;
    for (let y = 0; y < document.body.scrollHeight; y += 450) {
      window.scrollTo(0, y);
      m = Math.max(m, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    }
    return m;
  });
  console.log(`${n.padEnd(8)} горизонтальное переполнение: ${overflow}px`);
  await p.close();
}

// ── Секции: снимаем ВЬЮПОРТ на нужном скролле, а не сам элемент.
//    element.screenshot() на блоке выше вьюпорта тащит фиксированную шапку
//    в середину кадра и ловит анимации на полпути. ──
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on("pageerror", (e) => errs.push(`[sections] ${e.message}`));
await p.goto(URL, { waitUntil: "networkidle", timeout: 90000 });
await p.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 400) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 55));
  }
});
await p.waitForTimeout(1500); // дать reveal-анимациям доиграть

const shots = [
  ["01-hero", "#top", 0],
  ["02-solutions", "#product", 40],
  ["03-fuscum", "#fuscum", 40],
  ["04-applications", "#applications", 40],
  ["05-projects", "#projects", 40],
  ["06-advantages", "#advantages", 40],
  ["07-faq", "#faq", 40],
  ["08-contact", "#contact", 40],
];
for (const [name, sel, pad] of shots) {
  const y = await p.evaluate(
    ([s, offset]) => {
      const el = document.querySelector(s);
      return el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset) : null;
    },
    [sel, pad],
  );
  if (y === null) {
    console.log(`ПРОПУЩЕНО ${name}: селектор ${sel} не найден`);
    continue;
  }
  await p.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await p.waitForTimeout(650);
  await p.screenshot({ path: `${OUT}/${name}.png` });
}
await p.close();

console.log(errs.length ? "ОШИБКИ JS: " + [...new Set(errs)].join(" | ") : "ошибок JS нет");
const uniqFail = [...new Set(failedReq)];
console.log(uniqFail.length ? "ПРОБЛЕМНЫЕ ЗАПРОСЫ:\n  " + uniqFail.join("\n  ") : "все запросы прошли");
await b.close();
