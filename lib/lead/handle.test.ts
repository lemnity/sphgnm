import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SendmailError } from "./mail.ts";
import { createLeadLimiter, handleLead, MAX_BODY_BYTES, readBodyLimited, resolveLeadConfig } from "./handle.ts";

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
  let calls = 0;
  const limiter = createLeadLimiter();
  const run = (body: unknown, key = "ip:1", now = new Date("2026-10-10T08:00:00Z")) =>
    handleLead({
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
    });
  return { run, sent, logs };
}

test("заявка уходит команде: Reply-To — клиент, обе части письма", async () => {
  const { run, sent, logs } = setup();
  assert.deepEqual(await run(lead), { status: 200, body: { ok: true } });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].from, "noreply@sphagnum.ae");
  const raw = sent[0].raw;
  assert.match(raw, /^From: "Sphagnum Eco" <noreply@sphagnum\.ae>$/m);
  assert.match(raw, /^To: team@sphagnum\.ae$/m);
  assert.match(raw, /^Reply-To: =\?UTF-8\?B\?.+\?= <anna@example\.com>$/m);
  assert.match(raw, /^Message-ID: <.+@sphagnum\.ae>$/m);
  const text = decoded(raw);
  assert.match(text, /Content-Type: text\/plain[\s\S]+Имя и компания: Анна Петрова, Acme/);
  assert.match(text, /Content-Type: text\/html[\s\S]+Нужен &lt;b&gt;субстрат&lt;\/b&gt;/);
  assert.match(text, /Заявка № 261010-[A-Z2-9]{4}/);
  assert.ok(logs.every((line) => !line.includes("anna@") && !line.includes("Анна")));
});

test("LEAD_AUTOREPLY=1: второе письмо клиенту, Reply-To — команда", async () => {
  const { run, sent } = setup({ env: { LEAD_TO: "team@sphagnum.ae, boss@sphagnum.ae", LEAD_AUTOREPLY: "1", LEAD_FROM: "Sales <sales@sphagnum.ae>" } });
  assert.equal((await run(lead)).status, 200);
  assert.equal(sent.length, 2);
  assert.match(sent[0].raw, /^To: team@sphagnum\.ae, boss@sphagnum\.ae$/m);
  assert.match(decoded(sent[0].raw), /Клиент получил автоответ/);
  assert.match(sent[1].raw, /^To: =\?UTF-8\?B\?.+\?= <anna@example\.com>$/m);
  assert.match(sent[1].raw, /^Reply-To: team@sphagnum\.ae$/m);
  assert.match(sent[1].raw, /^Auto-Submitted: auto-replied$/m);
  assert.match(decoded(sent[1].raw), /Thank you, Анна\./);
  assert.equal(sent[1].from, "sales@sphagnum.ae");
});

test("без LEAD_TO — почта из контактов; без неё — 500 notConfigured", async () => {
  const fallback = setup({ env: {} });
  assert.equal((await fallback.run(lead)).status, 200);
  assert.match(fallback.sent[0].raw, /^To: sales@sphagnum\.ae$/m);

  assert.deepEqual(resolveLeadConfig({}, ""), { problem: "нет получателя: задайте LEAD_TO или почту в контактах" });
  assert.ok("problem" in resolveLeadConfig({ LEAD_FROM: "bad" }, "a@b.co"));
});

test("ловушка: 200 без письма", async () => {
  const { run, sent } = setup();
  assert.deepEqual(await run({ ...lead, website: "spam" }), { status: 200, body: { ok: true } });
  assert.equal(sent.length, 0);
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
