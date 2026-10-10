import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SendmailError } from "./mail.ts";
import { autoreplyAllowed, createLeadLimiter, handleLead, MAX_BODY_BYTES, readBodyLimited, resolveLeadConfig } from "./handle.ts";

const templates = {
  notification: readFileSync(new URL("../../emails/lead-notification.html", import.meta.url), "utf8"),
  autoreply: readFileSync(new URL("../../emails/lead-autoreply.html", import.meta.url), "utf8"),
};
const site = { projectTypes: ["Green roof / podium", "Other"], siteUrl: "https://sphagnum.ae", salesEmail: "sales@sphagnum.ae" };
const lead = { name: "Анна Петрова, Acme", email: "anna@example.com", phone: "+971 50 1", projectType: "Other", area: "500", message: "Нужен <b>субстрат</b>" };

/** Части письма в текст: base64-тела раскодированы. */
function decoded(raw: string) {
  return raw.replace(/\n\n([A-Za-z0-9+/=\n]+?)\n--/g, (_, body: string) => `\n\n${Buffer.from(body.replace(/\n/g, ""), "base64").toString("utf8")}\n--`);
}

function setup({ env = { LEAD_TO: "team@sphagnum.ae" } as Record<string, string>, fail = [] as number[] } = {}) {
  const sent: { raw: string; from: string }[] = [];
  const logs: string[] = [];
  const tasks: Promise<void>[] = [];
  let calls = 0;
  const limiter = createLeadLimiter();
  const run = async (body: unknown, key = "ip:1", now = new Date("2026-10-10T08:00:00Z")) => {
    const result = await handleLead({
      rawBody: typeof body === "string" ? body : JSON.stringify(body),
      key,
      limiter,
      site,
      env,
      loadTemplates: async () => templates,
      transport: async (raw, from) => {
        if (fail.includes(calls++)) throw new SendmailError("boom", "exit 75");
        sent.push({ raw, from });
      },
      now,
      log: { info: (line: string) => logs.push(line), error: (line: string) => logs.push(line) },
      background: (task) => tasks.push(task),
    });
    // Фоновый автоответ дожидаемся, чтобы проверить его письмо.
    await Promise.all(tasks.splice(0));
    return result;
  };
  return { run, sent, logs, limiter };
}

test("заявка уходит команде: без Reply-To, с заголовками автоматического письма, обе части", async () => {
  const { run, sent, logs } = setup();
  assert.deepEqual(await run(lead), { status: 200, body: { ok: true } });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].from, "noreply@sphagnum.ae");
  const raw = sent[0].raw;
  assert.match(raw, /^From: "Sphagnum Eco" <noreply@sphagnum\.ae>$/m);
  assert.match(raw, /^To: team@sphagnum\.ae$/m);
  assert.doesNotMatch(raw, /^Reply-To:/im);
  assert.match(raw, /^Auto-Submitted: auto-generated$/m);
  assert.match(raw, /^X-Auto-Response-Suppress: All$/m);
  assert.match(raw, /^Message-ID: <.+@sphagnum\.ae>$/m);
  const text = decoded(raw);
  assert.match(text, /Content-Type: text\/plain[\s\S]+Имя и компания: Анна Петрова, Acme/);
  assert.match(text, /Content-Type: text\/html[\s\S]+Нужен &lt;b&gt;субстрат&lt;\/b&gt;/);
  assert.match(text, /Заявка № 261010-[A-Z2-9]{4}/);
  assert.match(text, /отвечать на него не нужно\. Все заявки — в кабинете: https:\/\/sphagnum\.ae\/admin/);
  assert.doesNotMatch(text, /mailto:|tel:|wa\.me/);
  assert.ok(logs.every((line) => !line.includes("anna@") && !line.includes("Анна")));
});

test("LEAD_AUTOREPLY=1: второе письмо клиенту, тоже без Reply-To", async () => {
  const { run, sent } = setup({ env: { LEAD_TO: "team@sphagnum.ae, boss@sphagnum.ae", LEAD_AUTOREPLY: "1", LEAD_FROM: "Sales <sales@sphagnum.ae>" } });
  assert.equal((await run(lead)).status, 200);
  assert.equal(sent.length, 2);
  assert.match(sent[0].raw, /^To: team@sphagnum\.ae, boss@sphagnum\.ae$/m);
  assert.match(decoded(sent[0].raw), /Клиенту отправлен автоответ/);
  assert.match(sent[1].raw, /^To: anna@example\.com$/m);
  assert.doesNotMatch(sent[1].raw, /^Reply-To:/im);
  assert.match(sent[1].raw, /^Auto-Submitted: auto-generated$/m);
  assert.match(sent[1].raw, /^X-Auto-Response-Suppress: All$/m);
  assert.match(decoded(sent[1].raw), /This is an automated message, please do not reply\./);
  assert.match(decoded(sent[1].raw), /Thank you, Анна\./);
  assert.equal(sent[1].from, "sales@sphagnum.ae");
  // В автоответе нет свободного текста из формы.
  const reply = decoded(sent[1].raw);
  assert.doesNotMatch(reply, /Петрова|Acme|\+971|субстрат/);
});

test("автоответ ответа не задерживает: HTTP-ответ готов до конца отправки", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const sent: string[] = [];
  let pending: Promise<void> | undefined;
  const result = await handleLead({
    rawBody: JSON.stringify(lead),
    key: "k",
    limiter: createLeadLimiter(),
    site,
    env: { LEAD_TO: "team@sphagnum.ae", LEAD_AUTOREPLY: "1" },
    loadTemplates: async () => templates,
    transport: async (raw) => {
      if (sent.length === 1) await gate;
      sent.push(raw);
    },
    log: { info() {}, error() {} },
    background: (task) => (pending = task),
  });
  assert.equal(result.status, 200);
  assert.equal(sent.length, 1);
  release();
  await pending;
  assert.equal(sent.length, 2);
});

test("автоответ не уходит на свой домен и адреса команды", async () => {
  const config = resolveLeadConfig({ LEAD_TO: "team@lead-box.com", LEAD_FROM: "noreply@mail.sphagnum.ae" }, "sales@sphagnum.ae");
  assert.ok("config" in config);
  const c = config.config;
  assert.equal(autoreplyAllowed("anna@example.com", c, "sales@sphagnum.ae"), true);
  // Домен команды — не наш: на нём бывают и клиенты (gmail.com).
  assert.equal(autoreplyAllowed("other@lead-box.com", c, "sales@sphagnum.ae"), true);
  assert.equal(autoreplyAllowed("owner@gmail.com", c, "Owner@Gmail.com"), false);
  for (const email of ["boss@sphagnum.ae", "x@SPHAGNUM.AE", "x@eu.sphagnum.ae", "x@mail.sphagnum.ae", "TEAM@lead-box.com"]) {
    assert.equal(autoreplyAllowed(email, c, "sales@sphagnum.ae"), false, email);
  }
  const { run, sent, logs } = setup({ env: { LEAD_TO: "team@sphagnum.ae", LEAD_AUTOREPLY: "1" } });
  assert.equal((await run({ ...lead, email: "someone@sphagnum.ae" })).status, 200);
  assert.equal(sent.length, 1);
  assert.match(decoded(sent[0].raw), /Автоответ клиенту не отправлялся/);
  assert.match(logs.join("\n"), /автоответ пропущен/);
});

test("без LEAD_TO — почта из контактов; без неё — 500 sendFailed", async () => {
  const fallback = setup({ env: {} });
  assert.equal((await fallback.run(lead)).status, 200);
  assert.match(fallback.sent[0].raw, /^To: sales@sphagnum\.ae$/m);

  // Наружу — тот же sendFailed, что и при сбое sendmail; разница только в логе.
  const broken = setup({ env: { LEAD_FROM: "not an address" } });
  const result = await broken.run(lead);
  assert.equal(result.status, 500);
  assert.equal(result.status === 500 && result.body.code, "sendFailed");
  assert.match(broken.logs.join("\n"), /почта не настроена/);

  assert.deepEqual(resolveLeadConfig({}, ""), { problem: "нет получателя: задайте LEAD_TO или почту в контактах" });
  assert.ok("problem" in resolveLeadConfig({ LEAD_FROM: "bad" }, "a@b.co"));
});

test("ловушка: 200 без письма, общий потолок не тратится", async () => {
  const { run, sent, logs } = setup();
  assert.deepEqual(await run({ ...lead, website: "spam" }), { status: 200, body: { ok: true } });
  assert.equal(sent.length, 0);
  assert.match(logs[0], /^\[lead\] ловушка: заявка отброшена \(всего с запуска: \d+\)$/);
  // Бот с 20 адресов по 5 раз — 100 срабатываний, больше общего потолка в 60.
  for (let ip = 0; ip < 20; ip++) for (let i = 0; i < 5; i++) await run({ ...lead, website: "spam" }, `bot:${ip}`);
  assert.equal((await run(lead, "customer")).status, 200);
  assert.equal(sent.length, 1);
  // Ключ бота при этом упирается в свой лимит.
  assert.equal((await run({ ...lead, website: "spam" }, "bot:0")).status, 429);
});

test("ошибки запроса — 400 с кодом", async () => {
  const { run, sent } = setup();
  assert.deepEqual(await run("{not json"), { status: 400, body: { error: "Invalid request.", code: "invalidRequest" } });
  assert.deepEqual(await run({ ...lead, email: "nope" }), {
    status: 400,
    body: { error: "Please enter a valid email address.", code: "invalidEmail", field: "email" },
  });
  assert.equal(sent.length, 0);
});

test("лимит: 5 за 10 минут на ключ, затем 429; неверные запросы не считаются", async () => {
  const { run } = setup();
  for (let i = 0; i < 3; i++) await run({ ...lead, email: "bad" });
  for (let i = 0; i < 5; i++) assert.equal((await run(lead)).status, 200);
  const limited = await run(lead);
  assert.equal(limited.status, 429);
  assert.ok(limited.status === 429 && limited.retryAfter > 0 && limited.retryAfter <= 600);
  assert.equal(limited.body.code, "rateLimited");
  assert.equal((await run(lead, "ip:2")).status, 200);
  assert.equal((await run(lead, "ip:1", new Date("2026-10-10T08:10:01Z"))).status, 200);
});

test("общий потолок — 60 в час", () => {
  const limiter = createLeadLimiter();
  const t = Date.parse("2026-10-10T08:00:00Z");
  for (let i = 0; i < 60; i++) limiter.hit(`ip:${i}`, t);
  assert.ok(limiter.retryAfter("ip:new", t) > 0);
  assert.equal(limiter.retryAfter("ip:new", t + 60 * 60_000), 0);
});

test("sendmail упал — 500 sendFailed, в логе только номер и причина", async () => {
  const { run, logs } = setup({ fail: [0] });
  assert.deepEqual(await run(lead), {
    status: 500,
    body: { error: "We could not send your enquiry. Please try again later or email us directly.", code: "sendFailed" },
  });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /^\[lead\] 261010-[A-Z2-9]{4}: письмо команде не ушло \(exit 75\)$/);
});

test("автоответ упал — заявка всё равно принята", async () => {
  const { run, sent, logs } = setup({ env: { LEAD_TO: "team@sphagnum.ae", LEAD_AUTOREPLY: "1" }, fail: [1] });
  // Автоответ — в фоне; его сбой виден только в логе, по номеру заявки.
  assert.equal((await run(lead)).status, 200);
  assert.equal(sent.length, 1);
  assert.match(logs.at(-1)!, /автоответ не ушёл \(exit 75\)/);
});

test("тело читается не больше 32 КБ", async () => {
  const stream = (size: number) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (let left = size; left > 0; left -= 1024) controller.enqueue(new Uint8Array(Math.min(1024, left)).fill(97));
        controller.close();
      },
    });
  assert.equal((await readBodyLimited(stream(MAX_BODY_BYTES)))?.length, MAX_BODY_BYTES);
  assert.equal(await readBodyLimited(stream(MAX_BODY_BYTES + 1)), null);
  assert.equal(await readBodyLimited(null), "");
});
