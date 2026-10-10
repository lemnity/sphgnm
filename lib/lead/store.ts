// Хранилище заявок: по JSON-файлу на заявку в LEADS_DIR (по умолчанию data/leads).
// Заявка пишется до отправки письма — сбой почты её не теряет.
import { randomBytes } from "node:crypto";
import { link, mkdir, readdir, readFile, rename, rm, statfs, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Lead } from "./validate.ts";

/** Номер заявки из createLeadId: YYMMDD-XXXX без похожих символов. */
export const LEAD_ID_RE = /^\d{6}-[A-HJ-NP-Z2-9]{4}$/;

export type MailStatus = "pending" | "sent" | "failed";
export type StoredLead = Lead & { id: string; submittedAt: string; mailStatus: MailStatus; read: boolean };

/** Больше заявок за сутки (по номеру YYMMDD) не храним: защита диска от потока ботов. */
export const MAX_LEADS_PER_DAY = 500;
/** Меньше свободного места — заявку не пишем. */
export const MIN_FREE_BYTES = 200 * 1024 * 1024;

export type LeadStoreOptions = {
  maxPerDay?: number;
  minFreeBytes?: number;
  /** Свободное место на диске каталога (тесты подменяют). */
  freeBytes?: (dir: string) => Promise<number>;
  log?: Pick<Console, "error">;
};

/** Отказ хранилища: code "ELIMIT" (суточный предел) или "ENOSPC" (мало места). */
export class LeadStoreRefused extends Error {
  readonly code: "ELIMIT" | "ENOSPC";
  constructor(code: "ELIMIT" | "ENOSPC") {
    super(code === "ELIMIT" ? "суточный предел заявок" : "мало места на диске");
    this.name = "LeadStoreRefused";
    this.code = code;
  }
}

const freeBytesOf = async (dir: string) => {
  const info = await statfs(dir);
  return Number(info.bavail) * Number(info.bsize);
};

export type LeadStore = {
  /** Новая заявка; занятый номер — ошибка с code "EEXIST", предел или нет места — LeadStoreRefused. */
  create(lead: StoredLead): Promise<void>;
  update(id: string, patch: Partial<Pick<StoredLead, "mailStatus" | "read">>): Promise<StoredLead | null>;
  get(id: string): Promise<StoredLead | null>;
  /** Все заявки, новые сверху. */
  list(): Promise<StoredLead[]>;
  remove(id: string): Promise<boolean>;
};

type Env = Record<string, string | undefined>;

export const leadsDirFrom = (env: Env = process.env, root = process.cwd()) => path.resolve(root, env.LEADS_DIR?.trim() || "data/leads");

const FIELDS = ["name", "email", "phone", "region", "projectType", "area", "message"] as const;

/** Проверка прочитанного файла: чужой или битый JSON в список не попадает. */
function asLead(data: unknown): StoredLead | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.id !== "string" || !LEAD_ID_RE.test(record.id)) return null;
  // Дата — настоящая ISO-строка: битая дата сломала бы сортировку, CSV и форматирование.
  if (typeof record.submittedAt !== "string" || record.submittedAt.length > 40 || !Number.isFinite(Date.parse(record.submittedAt))) return null;
  const lead = { id: record.id, submittedAt: record.submittedAt } as StoredLead;
  for (const field of FIELDS) lead[field] = typeof record[field] === "string" ? (record[field] as string) : "";
  lead.mailStatus = record.mailStatus === "sent" || record.mailStatus === "failed" ? record.mailStatus : "pending";
  lead.read = record.read === true;
  return lead;
}

export function createLeadStore(
  dir: string,
  { maxPerDay = MAX_LEADS_PER_DAY, minFreeBytes = MIN_FREE_BYTES, freeBytes = freeBytesOf, log = console }: LeadStoreOptions = {},
): LeadStore {
  const fileOf = (id: string) => {
    if (!LEAD_ID_RE.test(id)) throw new Error("bad lead id");
    return path.join(dir, `${id}.json`);
  };
  const tmpOf = (file: string) => `${file}.${randomBytes(6).toString("hex")}.tmp`;
  const json = (lead: StoredLead) => `${JSON.stringify(lead, null, 2)}\n`;

  /** Заявка из файла; битый файл — null, причина — в report (имя файла, без данных). */
  async function read(id: string, report?: (reason: string) => void): Promise<StoredLead | null> {
    if (!LEAD_ID_RE.test(id)) return null;
    let raw: string;
    try {
      raw = await readFile(fileOf(id), "utf8");
    } catch {
      return null; // файла нет — это не поломка
    }
    try {
      const lead = asLead(JSON.parse(raw));
      if (lead?.id === id) return lead;
      report?.("неверные поля");
    } catch {
      report?.("не JSON");
    }
    return null;
  }
  const get = (id: string) => read(id);

  // Правки по очереди: «прочитано» и статус письма не затрут друг друга.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  };

  return {
    create: (lead) =>
      serial(async () => {
        const file = fileOf(lead.id);
        await mkdir(dir, { recursive: true });
        if ((await freeBytes(dir)) < minFreeBytes) throw new LeadStoreRefused("ENOSPC");
        const day = `${lead.id.slice(0, 6)}-`;
        const today = (await readdir(dir)).filter((name) => name.startsWith(day) && name.endsWith(".json")).length;
        if (today >= maxPerDay) throw new LeadStoreRefused("ELIMIT");
        const tmp = tmpOf(file);
        await writeFile(tmp, json(lead), { flag: "wx" });
        try {
          // link не перезапишет существующий файл: номер занят — EEXIST.
          await link(tmp, file);
        } finally {
          await unlink(tmp).catch(() => {});
        }
      }),
    update: (id, patch) =>
      serial(async () => {
        const current = await get(id);
        if (!current) return null;
        const next = { ...current, ...patch };
        const file = fileOf(id);
        const tmp = tmpOf(file);
        try {
          await writeFile(tmp, json(next));
          await rename(tmp, file);
        } catch (error) {
          await rm(tmp, { force: true });
          throw error;
        }
        return next;
      }),
    get,
    async list() {
      let names: string[];
      try {
        names = await readdir(dir);
      } catch {
        return [];
      }
      const ids = names.filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5)).filter((id) => LEAD_ID_RE.test(id));
      // Битый файл не ломает список и CSV: пропускаем и пишем в лог имя файла.
      const leads = (await Promise.all(ids.map((id) => read(id, (reason) => log.error(`[leads] пропущен файл ${id}.json: ${reason}`))))).filter(
        (lead): lead is StoredLead => lead !== null,
      );
      return leads.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : a.submittedAt > b.submittedAt ? -1 : a.id < b.id ? 1 : -1));
    },
    remove: (id) =>
      serial(async () => {
        if (!LEAD_ID_RE.test(id)) return false;
        try {
          await unlink(fileOf(id));
          return true;
        } catch {
          return false;
        }
      }),
  };
}

/** Общее хранилище процесса: роуты собираются отдельно, очередь правок должна быть одна. */
export function sharedLeadStore(dir = leadsDirFrom()): LeadStore {
  const registry = ((globalThis as typeof globalThis & { __sphLeadStores?: Map<string, LeadStore> }).__sphLeadStores ??= new Map());
  let store = registry.get(dir);
  if (!store) {
    store = createLeadStore(dir);
    registry.set(dir, store);
  }
  return store;
}

/* ---------- CSV ---------- */

/** Ячейка CSV: кавычки удваиваются; начало с = + - @ — апостроф, чтобы Excel не счёл формулой. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",;\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Таблица для Excel: UTF-8 с BOM, строки через CRLF. */
export function toCsv(header: string[], rows: string[][]): string {
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
