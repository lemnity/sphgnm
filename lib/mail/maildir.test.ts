import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, copyFile, mkdir, mkdtemp, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  allMessageIds,
  clearMaildirCache,
  decodeMailboxName,
  emptyMailState,
  isRead,
  listEntries,
  readHead,
  scanEntries,
  findMessage,
  listFolders,
  listMessages,
  loadMailState,
  maildirAvailable,
  readMessageFile,
  setMailRead,
  splitName,
} from "./maildir.ts";

const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));

/** Временный Maildir в раскладке Dovecot: .INBOX/{new,cur}, корень, .Sent, папка с кириллицей. */
async function makeMaildir() {
  const root = await mkdtemp(path.join(tmpdir(), "sph-maildir-"));
  const put = async (dir: string, name: string, fixture: string) => {
    await mkdir(path.join(root, dir), { recursive: true });
    await copyFile(path.join(fixtures, fixture), path.join(root, dir, name));
  };
  await put(".INBOX/new", "1791700000.M1P1.mx,S=501", "encoded-headers.eml");
  await put(".INBOX/cur", "1791600000.M2P1.mx,S=1174:2,S", "alternative.eml");
  await put(".INBOX/cur", "1791500000.M3P1.mx,S=1080:2,FS", "nested-mixed.eml");
  await put("cur", "1791400000.M4P1.mx:2,", "no-charset.eml");
  await mkdir(path.join(root, "new"), { recursive: true });
  await mkdir(path.join(root, "tmp"), { recursive: true });
  await writeFile(path.join(root, "tmp", "1791800000.M9.mx"), "in delivery");
  await put(".Sent/cur", "1791300000.M5P1.mx:2,S", "latin1.eml");
  await put(".&BBoEPgRABDcEOAQ9BDA-/cur", "1791200000.M6P1.mx:2,", "malformed-boundary.eml");
  await mkdir(path.join(root, ".Archive.2024", "cur"), { recursive: true });
  // Служебное и мусор: файлы Dovecot, скрытые файлы, симлинк наружу.
  await writeFile(path.join(root, "dovecot-uidlist"), "3 V1 N4\n");
  await writeFile(path.join(root, ".INBOX", "cur", ".hidden"), "x");
  await symlink("/etc/hosts", path.join(root, ".INBOX", "cur", "1791900000.M7P1.mx:2,"));
  await mkdir(path.join(root, ".NotAFolder"), { recursive: true });
  return root;
}

test("имена файлов и папок", () => {
  assert.deepEqual(splitName("1791700000.M1P1.mx,S=501:2,RS"), { stem: "1791700000.M1P1.mx,S=501", flags: "RS" });
  assert.deepEqual(splitName("1791700000.M1P1.mx!2,S"), { stem: "1791700000.M1P1.mx", flags: "S" });
  assert.deepEqual(splitName("plain"), { stem: "plain", flags: "" });
  assert.equal(decodeMailboxName("&BBoEPgRABDcEOAQ9BDA-"), "Корзина");
  assert.equal(decodeMailboxName("A&-B"), "A&B");
});

test("Maildir: папки, INBOX первой, непрочитанные по флагу S и отметкам кабинета", async () => {
  const root = await makeMaildir();
  try {
    assert.equal(await maildirAvailable(root), true);
    assert.equal(await maildirAvailable(path.join(root, "missing")), false);
    assert.equal(await maildirAvailable(undefined), false);
    const folders = await listFolders(root);
    assert.deepEqual(
      folders.map(({ id, name, total, unread }) => [id, name, total, unread]),
      [
        ["INBOX", "INBOX", 4, 2],
        [".&BBoEPgRABDcEOAQ9BDA-", "Корзина", 1, 1],
        [".Archive.2024", "Archive / 2024", 0, 0],
        [".Sent", "Sent", 1, 0],
      ],
    );
    const withState = await listFolders(root, { "1791700000.M1P1.mx,S=501": true, "1791600000.M2P1.mx,S=1174": false });
    assert.equal(withState[0].unread, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Maildir: список новых сверху, сводка по заголовкам, страницы", async () => {
  const root = await makeMaildir();
  try {
    const list = await listMessages(root, "INBOX");
    assert.equal(list.total, 4);
    assert.deepEqual(
      list.messages.map((row) => [row.subject, row.read, row.hasAttachments]),
      [
        ["Заявка на субстрат — крыша", false, false],
        ["Тест alternative", true, false],
        ["Drawings attached", true, true],
        ["Без кодировки", false, false],
      ],
    );
    assert.equal(list.messages[0].from, "Анна Петрова <anna@example.com>");
    assert.equal(list.messages[0].size, (await stat(path.join(root, ".INBOX/new/1791700000.M1P1.mx,S=501"))).size);
    // Нет Date — время доставки из имени файла.
    const sent = await listMessages(root, ".Sent");
    assert.equal(sent.messages[0].date, new Date(1791300000 * 1000).toISOString());

    const paged = await listMessages(root, "INBOX", { page: 2, pageSize: 3 });
    assert.equal(paged.pages, 2);
    assert.deepEqual(paged.messages.map((row) => row.subject), ["Без кодировки"]);
    assert.equal((await listMessages(root, "INBOX", { page: 99, pageSize: 3 })).page, 2);
    assert.equal((await listMessages(root, ".Missing")).total, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Maildir: поиск письма только среди файлов папки", async () => {
  const root = await makeMaildir();
  try {
    const entry = await findMessage(root, "INBOX", "1791500000.M3P1.mx,S=1080");
    assert.ok(entry);
    assert.match((await readMessageFile(entry)).toString("latin1"), /Drawings attached/);
    for (const [folder, id] of [
      ["INBOX", "../../etc/passwd"],
      ["INBOX", "1791900000.M7P1.mx"], // симлинк
      ["../..", "1791500000.M3P1.mx,S=1080"],
      [".Sent/../.INBOX", "1791500000.M3P1.mx,S=1080"],
      [".NotAFolder", "x"],
      ["INBOX", ".hidden"],
      ["INBOX", "1791800000.M9.mx"], // tmp/ не читается
    ]) {
      assert.equal(await findMessage(root, folder, id), null, `${folder} ${id}`);
    }
    assert.ok(await findMessage(root, ".Sent", "1791300000.M5P1.mx"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Maildir не меняется: чтение и отметки не трогают файлы", async () => {
  const root = await makeMaildir();
  const stateDir = await mkdtemp(path.join(tmpdir(), "sph-mailstate-"));
  try {
    const snapshot = async () => {
      const out: string[] = [];
      const walk = async (dir: string) => {
        for (const dirent of await readdir(dir, { withFileTypes: true })) {
          const full = path.join(dir, dirent.name);
          if (dirent.isDirectory()) await walk(full);
          else out.push(`${path.relative(root, full)}:${(await stat(full, { bigint: true })).mtimeNs}`);
        }
      };
      await walk(root);
      return out.sort().join("\n");
    };
    const before = await snapshot();
    const stateFile = path.join(stateDir, "data", "mail-state.json");
    await listFolders(root);
    await listMessages(root, "INBOX");
    const entry = await findMessage(root, "INBOX", "1791700000.M1P1.mx,S=501");
    await readMessageFile(entry!);
    await Promise.all([setMailRead(stateFile, "1791700000.M1P1.mx,S=501", true), setMailRead(stateFile, "1791600000.M2P1.mx,S=1174", false)]);
    assert.deepEqual({ ...(await loadMailState(stateFile)) }, { "1791700000.M1P1.mx,S=501": true, "1791600000.M2P1.mx,S=1174": false });
    const rows = (await listMessages(root, "INBOX", { state: await loadMailState(stateFile) })).messages;
    assert.deepEqual(rows.map((row) => row.read), [true, false, true, false]);
    assert.equal(await snapshot(), before);
    assert.deepEqual({ ...(await loadMailState(path.join(stateDir, "missing.json"))) }, {});
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("симлинки: каталоги new/cur и файлы-симлинки не читаются, открытие — с O_NOFOLLOW", async () => {
  const root = await makeMaildir();
  const outside = await mkdtemp(path.join(tmpdir(), "sph-outside-"));
  try {
    // Папка, чей cur/ — симлинк наружу, и письмо-симлинк, подменённое после проверки.
    await mkdir(path.join(outside, "cur"), { recursive: true });
    await copyFile(path.join(fixtures, "alternative.eml"), path.join(outside, "cur", "1791000000.M1.x:2,"));
    await mkdir(path.join(root, ".Evil"), { recursive: true });
    await symlink(path.join(outside, "cur"), path.join(root, ".Evil", "cur"));
    await symlink(outside, path.join(root, ".Linked"));
    const ids = (await listFolders(root)).map((folder) => folder.id);
    assert.ok(!ids.includes(".Evil") && !ids.includes(".Linked"), ids.join());
    assert.deepEqual(await listEntries(root, ".Evil"), []);
    assert.equal(await findMessage(root, ".Linked", "1791000000.M1.x"), null);
    await assert.rejects(readHead(path.join(root, ".INBOX", "cur", "1791900000.M7P1.mx:2,"), 10), { code: "ELOOP" });
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("отметки без прототипа: id «__proto__» и «constructor» — обычные ключи", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "sph-proto-"));
  try {
    const file = path.join(dir, "state.json");
    await writeFile(file, '{"read":{"__proto__":true,"constructor":false,"ok":true,"../x":true,"n":1}}');
    const state = await loadMailState(file);
    assert.equal(Object.getPrototypeOf(state), null);
    assert.deepEqual(Object.keys(state).sort(), ["__proto__", "constructor", "ok"].sort());
    assert.equal(isRead({ id: "toString", flags: "" }, emptyMailState()), false);
    assert.equal(isRead({ id: "hasOwnProperty", flags: "S" }, emptyMailState()), true);
    assert.equal(isRead({ id: "__proto__", flags: "" }, state), true);
    await setMailRead(file, "__proto__", false);
    assert.equal((await loadMailState(file))["__proto__"], false);
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("кэш списка папки сбрасывается при новом письме; отметки исчезнувших писем чистятся", async () => {
  const root = await makeMaildir();
  const dir = await mkdtemp(path.join(tmpdir(), "sph-prune-"));
  try {
    clearMaildirCache();
    const before = await listEntries(root, "INBOX");
    assert.equal(before.length, 4);
    assert.strictEqual(await listEntries(root, "INBOX"), before); // из кэша
    await new Promise((resolve) => setTimeout(resolve, 20));
    await copyFile(path.join(fixtures, "latin1.eml"), path.join(root, ".INBOX", "new", "1791750000.M8P1.mx"));
    assert.equal((await listEntries(root, "INBOX")).length, 5);

    const file = path.join(dir, "state.json");
    await writeFile(file, JSON.stringify({ read: { "gone.1": true, "1791600000.M2P1.mx,S=1174": true } }));
    const ids = (await allMessageIds(root))!;
    assert.ok(ids.has("1791300000.M5P1.mx") && ids.has("1791750000.M8P1.mx"));
    await setMailRead(file, "1791700000.M1P1.mx,S=501", true, ids);
    assert.deepEqual(Object.keys(await loadMailState(file)).sort(), ["1791600000.M2P1.mx,S=1174", "1791700000.M1P1.mx,S=501"]);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });
  }
});

test("временная ошибка чтения папки: отметки не чистятся, неполный список не кэшируется", { skip: process.getuid?.() === 0 }, async () => {
  const root = await makeMaildir();
  const dir = await mkdtemp(path.join(tmpdir(), "sph-eacces-"));
  const sent = path.join(root, ".Sent", "cur");
  try {
    clearMaildirCache();
    const file = path.join(dir, "state.json");
    await writeFile(file, JSON.stringify({ read: { "1791300000.M5P1.mx": false, "gone.1": true } }));
    assert.ok(await allMessageIds(root));
    // Dovecot пересобирает папку или права временно сбились — cur/ не читается.
    await chmod(sent, 0o000);
    assert.equal(await allMessageIds(root), null);
    const partial = await scanEntries(root, ".Sent");
    assert.deepEqual(partial, { entries: [], complete: false });
    await setMailRead(file, "1791700000.M1P1.mx,S=501", true, await allMessageIds(root));
    assert.deepEqual(Object.keys(await loadMailState(file)).sort(), ["1791300000.M5P1.mx", "1791700000.M1P1.mx,S=501", "gone.1"]);
    // Папка без прав на вход: lstat cur/ даёт EACCES — тоже неполный обход, а не «папки нет».
    await chmod(sent, 0o755);
    await chmod(path.join(root, ".Sent"), 0o000);
    assert.equal(await allMessageIds(root), null);
    await chmod(path.join(root, ".Sent"), 0o755);
    // Права вернулись — список снова полный (ошибочный не застрял в кэше), чистка работает.
    assert.equal((await listEntries(root, ".Sent")).length, 1);
    await setMailRead(file, "1791700000.M1P1.mx,S=501", true, await allMessageIds(root));
    assert.deepEqual(Object.keys(await loadMailState(file)).sort(), ["1791300000.M5P1.mx", "1791700000.M1P1.mx,S=501"]);
  } finally {
    await chmod(sent, 0o755).catch(() => {});
    await chmod(path.join(root, ".Sent"), 0o755).catch(() => {});
    await rm(root, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });
  }
});
