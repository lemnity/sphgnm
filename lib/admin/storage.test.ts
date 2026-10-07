import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  HISTORY_LIMIT,
  StorageError,
  deleteUpload,
  findUsages,
  listHistory,
  listUploads,
  readHistory,
  resolveUploadPath,
  saveUpload,
  sniffUploadType,
  writeContent,
} from "./storage.ts";

async function project() {
  const root = await mkdtemp(path.join(tmpdir(), "sph-admin-"));
  await mkdir(path.join(root, "content"));
  await writeFile(path.join(root, "content", "site.json"), '{"v":0}\n');
  return root;
}

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const bytesOf = (text: string) => new TextEncoder().encode(text);

async function rejects(promise: Promise<unknown>, status: number, pattern?: RegExp) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof StorageError, String(error));
    assert.equal(error.status, status);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
}

test("запись атомарная: новый файл целиком, старая версия в истории, tmp не остаётся", async () => {
  const root = await project();
  try {
    const id = await writeContent(root, "site", { v: 1 }, new Date("2026-10-08T12:34:56.789Z"));
    assert.equal(id, "site-2026-10-08T12-34-56-789Z.json");
    assert.equal(await readFile(path.join(root, "content", "site.json"), "utf8"), '{\n  "v": 1\n}\n');
    assert.equal(await readFile(path.join(root, "content", ".history", id!), "utf8"), '{"v":0}\n');
    assert.deepEqual(
      (await readdir(path.join(root, "content"))).filter((name) => name.endsWith(".tmp")),
      [],
    );
    const [entry] = await listHistory(root);
    assert.deepEqual({ ...entry, size: 0 }, { id, name: "site", savedAt: "2026-10-08T12:34:56.789Z", size: 0 });
    assert.deepEqual(await readHistory(root, id!), { name: "site", data: { v: 0 } });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("первое сохранение без прежнего файла не создаёт историю", async () => {
  const root = await project();
  try {
    assert.equal(await writeContent(root, "gallery", []), null);
    assert.deepEqual(await listHistory(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("история обрезается до 30 версий каждого файла, одинаковое время не затирает версии", async () => {
  const root = await project();
  try {
    const now = new Date("2026-01-01T00:00:00.000Z");
    for (let i = 1; i <= HISTORY_LIMIT + 5; i += 1) await writeContent(root, "site", { v: i }, now);
    await writeContent(root, "gallery", [], now);
    await writeContent(root, "gallery", [1], now);
    const entries = await listHistory(root);
    const site = entries.filter((entry) => entry.name === "site");
    assert.equal(site.length, HISTORY_LIMIT);
    assert.equal(entries.filter((entry) => entry.name === "gallery").length, 1);
    // Самая свежая версия истории — предпоследнее сохранение.
    assert.deepEqual((await readHistory(root, site[0].id)).data, { v: HISTORY_LIMIT + 4 });
    assert.deepEqual((await readHistory(root, site.at(-1)!.id)).data, { v: 5 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("параллельные сохранения не теряют версии", async () => {
  const root = await project();
  try {
    await Promise.all([1, 2, 3, 4, 5].map((v) => writeContent(root, "site", { v })));
    assert.equal((await listHistory(root)).length, 5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("readHistory: чужие имена и ../ отклоняются", async () => {
  const root = await project();
  try {
    await rejects(readHistory(root, "../site.json"), 400);
    await rejects(readHistory(root, "site-../../etc/passwd.json"), 400);
    await rejects(readHistory(root, "site-2026-01-01T00-00-00-000Z.json"), 404);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("загрузка: картинка сохраняется под случайным именем с расширением по содержимому", async () => {
  const root = await project();
  try {
    const saved = await saveUpload(root, { name: "photo.png", type: "image/png", bytes: JPG });
    assert.match(saved, /^uploads\/[0-9a-f]{16}\.jpg$/);
    assert.deepEqual(new Uint8Array(await readFile(path.join(root, "public", saved))), JPG);
    const listed = await listUploads(root);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].path, saved);
    assert.equal(listed[0].kind, "image");

    await deleteUpload(root, saved);
    assert.equal(existsSync(path.join(root, "public", saved)), false);
    await rejects(deleteUpload(root, saved), 404);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("загрузка: SVG и неизвестные типы отклоняются", async () => {
  const root = await project();
  try {
    const svg = bytesOf('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await rejects(saveUpload(root, { name: "x.svg", type: "image/svg+xml", bytes: svg }), 415, /SVG/);
    // SVG под видом jpg не пройдёт проверку содержимого.
    await rejects(saveUpload(root, { name: "x.jpg", type: "image/jpeg", bytes: svg }), 415);
    await rejects(saveUpload(root, { name: "x.html", type: "text/html", bytes: bytesOf("<html><body>hi</body></html>") }), 415);
    await rejects(saveUpload(root, { name: "x.jpg", type: "image/jpeg", bytes: new Uint8Array() }), 400);
    assert.deepEqual(await listUploads(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("загрузка: лимиты размера — картинки 15 МБ, видео 150 МБ", async () => {
  const root = await project();
  try {
    const big = new Uint8Array(15 * 1024 * 1024 + 1);
    big.set(PNG);
    await rejects(saveUpload(root, { name: "big.png", type: "image/png", bytes: big }), 413, /15 МБ/);

    const video = new Uint8Array(16 * 1024 * 1024);
    video.set([0, 0, 0, 0x18, ...bytesOf("ftypisom")]);
    assert.match(await saveUpload(root, { name: "clip.mp4", type: "video/mp4", bytes: video }), /\.mp4$/);

    const huge = { length: 150 * 1024 * 1024 + 1 } as Uint8Array;
    await rejects(saveUpload(root, { name: "huge.mp4", type: "video/mp4", bytes: huge }), 413);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("sniffUploadType", () => {
  const ftyp = (brand: string) => new Uint8Array([0, 0, 0, 0x1c, ...bytesOf(`ftyp${brand}`), 0, 0, 0, 0]);
  assert.equal(sniffUploadType(JPG), "jpg");
  assert.equal(sniffUploadType(PNG), "png");
  assert.equal(sniffUploadType(bytesOf("GIF89a......")), "gif");
  assert.equal(sniffUploadType(bytesOf("RIFF\0\0\0\0WEBPVP8 ")), "webp");
  assert.equal(sniffUploadType(ftyp("avif")), "avif");
  assert.equal(sniffUploadType(ftyp("mp42")), "mp4");
  assert.equal(sniffUploadType(ftyp("qt  ")), null);
  assert.equal(sniffUploadType(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...bytesOf("\x9f\x42\x82\x84webm")])), "webm");
  assert.equal(sniffUploadType(bytesOf("<?xml version='1.0'?><svg/>")), null);
});

test("resolveUploadPath: только файлы прямо в public/uploads", async () => {
  const root = "/srv/site";
  assert.equal(resolveUploadPath(root, "uploads/abc123.jpg"), "/srv/site/public/uploads/abc123.jpg");
  for (const bad of [
    "uploads/../content/site.json",
    "uploads/..",
    "../uploads/a.jpg",
    "/uploads/a.jpg",
    "uploads/sub/a.jpg",
    "uploads/.env",
    "media/hero.webp",
    "uploads/a.jpg/",
    "uploads/a%2F..%2Fb.jpg",
  ]) {
    assert.throws(() => resolveUploadPath(root, bad), StorageError, bad);
  }
});

test("findUsages находит путь в контенте", () => {
  const site = { hero: { image: { src: "uploads/a.jpg" } }, items: [{ src: "media/b.webp" }, { poster: "uploads/a.jpg" }] };
  assert.deepEqual(findUsages(site, "uploads/a.jpg"), ["hero.image.src", "items[1].poster"]);
});
