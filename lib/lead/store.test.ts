import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { SendmailError } from "./mail.ts";
import { createLeadLimiter, handleLead } from "./handle.ts";
import { createLeadStore, csvCell, LEAD_ID_RE, LeadStoreRefused, leadsDirFrom, MAX_LEADS_PER_DAY, MIN_FREE_BYTES, toCsv, type StoredLead } from "./store.ts";

const sample = (id: string, submittedAt: string, extra: Partial<StoredLead> = {}): StoredLead => ({
  id,
  submittedAt,
  name: "Anna",
  email: "anna@example.com",
  phone: "",
  region: "",
  projectType: "Other",
  area: "",
  message: "",
  mailStatus: "sent",
  read: false,
  ...extra,
});

async function tempDir() {
  return mkdtemp(path.join(tmpdir(), "sph-leads-"));
}

test("номер заявки: строгая проверка", () => {
  assert.ok(LEAD_ID_RE.test("261010-AB2C"));
  for (const bad of ["../../etc/passwd", "261010-ab2c", "261010-AB2C.json", "261010-AB1C", "261010-AB2CD", "", "261010-AB2C/.."]) {
    assert.equal(LEAD_ID_RE.test(bad), false, bad);
  }
});

test("LEADS_DIR: по умолчанию data/leads от корня", () => {
  assert.equal(leadsDirFrom({}, "/srv/app"), "/srv/app/data/leads");
  assert.equal(leadsDirFrom({ LEADS_DIR: "/var/lib/leads" }, "/srv/app"), "/var/lib/leads");
});

test("хранилище: создание, список новых сверху, правка, удаление", async () => {
  const dir = await tempDir();
  try {
    const store = createLeadStore(path.join(dir, "nested", "leads"));
    assert.deepEqual(await store.list(), []);
    await store.create(sample("261010-AAAA", "2026-10-10T08:00:00.000Z"));
    await store.create(sample("261011-BBBB", "2026-10-11T08:00:00.000Z"));
    await assert.rejects(store.create(sample("261010-AAAA", "2026-10-10T09:00:00.000Z")), { code: "EEXIST" });
    assert.deepEqual((await store.list()).map((lead) => lead.id), ["261011-BBBB", "261010-AAAA"]);
    // Повтор с занятым номером не затёр первую заявку.
    assert.equal((await store.get("261010-AAAA"))?.submittedAt, "2026-10-10T08:00:00.000Z");

    const [a, b] = await Promise.all([store.update("261010-AAAA", { read: true }), store.update("261010-AAAA", { mailStatus: "failed" })]);
    assert.ok(a && b);
    const updated = await store.get("261010-AAAA");
    assert.equal(updated?.read, true);
    assert.equal(updated?.mailStatus, "failed");
    assert.equal(await store.update("261012-CCCC", { read: true }), null);

    assert.equal(await store.get("../../../etc/passwd"), null);
    assert.equal(await store.remove("../x"), false);
    assert.equal(await store.remove("261011-BBBB"), true);
    assert.equal(await store.remove("261011-BBBB"), false);
    // Временных файлов не осталось.
    assert.deepEqual(await readdir(path.join(dir, "nested", "leads")), ["261010-AAAA.json"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("хранилище: чужие и битые файлы пропускаются", async () => {
  const dir = await tempDir();
  try {
    const store = createLeadStore(dir);
    await writeFile(path.join(dir, "notes.json"), "{}");
    await writeFile(path.join(dir, "261010-AAAA.json"), "{broken");
    await writeFile(path.join(dir, "261010-BBBB.json"), JSON.stringify({ id: "261010-CCCC", submittedAt: "x" }));
    await store.create(sample("261010-DDDD", "2026-10-10T08:00:00.000Z", { read: "yes" as unknown as boolean }));
    const list = await store.list();
    // Файл с чужим номером внутри тоже не считается заявкой.
    assert.deepEqual(list.map((lead) => lead.id), ["261010-DDDD"]);
    assert.equal(list[0].read, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CSV: BOM, CRLF, кавычки и защита от формул", () => {
  assert.equal(csvCell('He said "hi", ok'), '"He said ""hi"", ok"');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell("+971 50"), "'+971 50");
  assert.equal(csvCell("line\nbreak"), '"line\nbreak"');
  const csv = toCsv(["Номер", "Дата", "Имя", "Сообщение", "Прочитано"], [["261010-AAAA", "2026-10-10", "Анна; Acme", "a\nb", "1"]]);
  assert.ok(csv.startsWith("﻿Номер,Дата,Имя,Сообщение,Прочитано\r\n"));
  assert.ok(csv.includes('261010-AAAA,2026-10-10,"Анна; Acme","a\nb",1\r\n'));
});

const templates = {
  notification: readFileSync(new URL("../../emails/lead-notification.html", import.meta.url), "utf8"),
  autoreply: readFileSync(new URL("../../emails/lead-autoreply.html", import.meta.url), "utf8"),
};
const site = { projectTypes: ["Other"], siteUrl: "https://sphagnum.ae", salesEmail: "sales@sphagnum.ae" };
const lead = { name: "Anna", email: "anna@example.com", projectType: "Other", message: "Hi" };

async function submit(store: ReturnType<typeof createLeadStore>, { fail = false, env = { LEAD_TO: "team@sphagnum.ae" } as Record<string, string>, body = lead as unknown } = {}) {
  const logs: string[] = [];
  let storedBeforeSend: StoredLead[] | null = null;
  const result = await handleLead({
    rawBody: JSON.stringify(body),
    key: "k",
    limiter: createLeadLimiter(),
    site,
    env,
    loadTemplates: async () => templates,
    transport: async () => {
      storedBeforeSend = await store.list();
      if (fail) throw new SendmailError("boom", "exit 75");
    },
    now: new Date("2026-10-10T08:00:00Z"),
    log: { info: (line: string) => logs.push(line), error: (line: string) => logs.push(line) },
    store,
  });
  return { result, logs, storedBeforeSend: storedBeforeSend as StoredLead[] | null };
}

test("заявка сохраняется до отправки; статус письма — sent", async () => {
  const dir = await tempDir();
  try {
    const store = createLeadStore(dir);
    const { result, storedBeforeSend } = await submit(store);
    assert.equal(result.status, 200);
    assert.equal(storedBeforeSend?.length, 1);
    assert.equal(storedBeforeSend?.[0].mailStatus, "pending");
    const [saved] = await store.list();
    assert.match(saved.id, LEAD_ID_RE);
    assert.equal(saved.submittedAt, "2026-10-10T08:00:00.000Z");
    assert.equal(saved.name, "Anna");
    assert.equal(saved.phone, "");
    assert.equal(saved.mailStatus, "sent");
    assert.equal(saved.read, false);
    const raw = JSON.parse(await readFile(path.join(dir, `${saved.id}.json`), "utf8"));
    assert.deepEqual(Object.keys(raw).sort(), ["area", "email", "id", "mailStatus", "message", "name", "phone", "projectType", "read", "region", "submittedAt"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("сбой почты не теряет заявку: статус failed, ответ прежний 500", async () => {
  const dir = await tempDir();
  try {
    const store = createLeadStore(dir);
    const { result } = await submit(store, { fail: true });
    assert.equal(result.status, 500);
    assert.equal((await store.list())[0].mailStatus, "failed");
    // Почта не настроена — тоже сохраняем.
    const broken = await submit(store, { env: { LEAD_FROM: "bad" }, body: { ...lead, email: "b@example.com" } });
    assert.equal(broken.result.status, 500);
    assert.equal((await store.list()).length, 2);
    assert.ok((await store.list()).every((saved) => saved.mailStatus === "failed"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ловушка и невалидная заявка не сохраняются", async () => {
  const dir = await tempDir();
  try {
    const store = createLeadStore(dir);
    assert.equal((await submit(store, { body: { ...lead, website: "spam" } })).result.status, 200);
    assert.equal((await submit(store, { body: { ...lead, email: "nope" } })).result.status, 400);
    assert.deepEqual(await store.list(), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("хранилище сломано — письмо всё равно уходит, в логе причина без данных", async () => {
  const store = {
    create: async () => {
      throw Object.assign(new Error("denied"), { code: "EACCES" });
    },
    update: async () => null,
    get: async () => null,
    list: async () => [],
    remove: async () => false,
  };
  const logs: string[] = [];
  let sent = 0;
  const result = await handleLead({
    rawBody: JSON.stringify(lead),
    key: "k",
    limiter: createLeadLimiter(),
    site,
    env: { LEAD_TO: "team@sphagnum.ae" },
    loadTemplates: async () => templates,
    transport: async () => void sent++,
    log: { info: (line: string) => logs.push(line), error: (line: string) => logs.push(line) },
    store,
  });
  assert.equal(result.status, 200);
  assert.equal(sent, 1);
  assert.match(logs.join("\n"), /заявка не сохранена \(EACCES\)/);
  assert.ok(logs.every((line) => !line.includes("anna@")));
});

test("битая дата или JSON: заявка пропускается, в лог — имя файла; список и CSV не ломаются", async () => {
  const dir = await tempDir();
  try {
    const logs: string[] = [];
    const store = createLeadStore(dir, { log: { error: (line: string) => logs.push(line) } });
    await store.create(sample("261010-AAAA", "2026-10-10T08:00:00.000Z"));
    const bad = (id: string, submittedAt: unknown) => writeFile(path.join(dir, `${id}.json`), JSON.stringify({ ...sample(id, ""), submittedAt }));
    await bad("261010-BBBB", "not a date");
    await bad("261010-CCCC", 1791700000);
    await bad("261010-DDDD", "2026-10-10T08:00:00.000Z" + " ".repeat(100));
    await writeFile(path.join(dir, "261010-EEEE.json"), "{oops");
    const list = await store.list();
    assert.deepEqual(list.map((lead) => lead.id), ["261010-AAAA"]);
    assert.equal(logs.length, 4);
    assert.ok(logs.every((line) => /^\[leads\] пропущен файл 261010-[B-E]{4}\.json: /.test(line)), logs.join("\n"));
    assert.ok(logs.every((line) => !line.includes("anna@")));
    assert.equal(await store.get("261010-BBBB"), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("предел заявок за сутки и мало места: не пишем, письмо всё равно уходит", async () => {
  const dir = await tempDir();
  try {
    assert.equal(MAX_LEADS_PER_DAY, 500);
    assert.equal(MIN_FREE_BYTES, 200 * 1024 * 1024);
    const capped = createLeadStore(dir, { maxPerDay: 2, freeBytes: async () => 10 * MIN_FREE_BYTES });
    await capped.create(sample("261010-AAAA", "2026-10-10T08:00:00.000Z"));
    await capped.create(sample("261010-BBBB", "2026-10-10T08:00:00.000Z"));
    await assert.rejects(capped.create(sample("261010-CCCC", "2026-10-10T08:00:00.000Z")), (error) => error instanceof LeadStoreRefused && error.code === "ELIMIT");
    // Другие сутки — свой счётчик.
    await capped.create(sample("261011-AAAA", "2026-10-11T08:00:00.000Z"));

    let free = MIN_FREE_BYTES - 1;
    const full = createLeadStore(dir, { freeBytes: async () => free });
    await assert.rejects(full.create(sample("261012-AAAA", "2026-10-12T08:00:00.000Z")), { code: "ENOSPC" });
    free = MIN_FREE_BYTES;
    await full.create(sample("261012-AAAA", "2026-10-12T08:00:00.000Z"));

    // Через handleLead: ответ обычный, письмо ушло, в логе только код.
    free = 0;
    const logs: string[] = [];
    let sent = 0;
    const result = await handleLead({
      rawBody: JSON.stringify(lead),
      key: "k",
      limiter: createLeadLimiter(),
      site,
      env: { LEAD_TO: "team@sphagnum.ae" },
      loadTemplates: async () => templates,
      transport: async () => void sent++,
      log: { info: (line: string) => logs.push(line), error: (line: string) => logs.push(line) },
      store: full,
    });
    assert.equal(result.status, 200);
    assert.equal(sent, 1);
    assert.match(logs.join("\n"), /заявка не сохранена \(ENOSPC\)/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("свободное место по умолчанию — statfs каталога", async () => {
  const dir = await tempDir();
  try {
    await createLeadStore(dir).create(sample("261010-AAAA", "2026-10-10T08:00:00.000Z"));
    assert.equal((await readdir(dir)).length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
