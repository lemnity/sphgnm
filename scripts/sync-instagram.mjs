// Синхронизация блока «Global portfolios» с Instagram @sphagnum_eco.
//
// Анонимно Instagram посты не отдаёт (web_profile_info → 401 require_login,
// embed-страница без данных), поэтому ходим в официальный Instagram API
// (Instagram Login, graph.instagram.com) с долгоживущим токеном аккаунта.
//
// Что делает:
//   1. берёт последние INSTAGRAM_LIMIT постов (по умолчанию 9);
//   2. скачивает картинки в public/instagram/<id>.jpg — ссылки CDN Instagram
//      протухают через несколько дней, хранить их в JSON нельзя;
//   3. пишет components/instagram-feed.json, который читает лендинг;
//   4. удаляет картинки постов, выпавших из выборки.
//
// Без INSTAGRAM_ACCESS_TOKEN скрипт ничего не трогает и выходит с кодом 0:
// локальная сборка и сборка без секрета остаются на закоммиченном JSON.
//
// Запуск: INSTAGRAM_ACCESS_TOKEN=... node scripts/sync-instagram.mjs

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FEED_FILE = path.join(root, "components/instagram-feed.json");
const IMAGE_DIR = path.join(root, "public/instagram");

const token = process.env.INSTAGRAM_ACCESS_TOKEN;
const limit = Number(process.env.INSTAGRAM_LIMIT || 9);
const API = "https://graph.instagram.com/v23.0";

if (!token) {
  console.warn("INSTAGRAM_ACCESS_TOKEN не задан — синхронизация пропущена, остаётся текущий instagram-feed.json.");
  process.exit(0);
}

async function api(pathname, params) {
  const url = new URL(`${API}/${pathname}`);
  for (const [key, value] of Object.entries({ ...params, access_token: token })) url.searchParams.set(key, String(value));
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Текст ошибки API без токена: в логах Actions он не нужен.
    throw new Error(`Instagram API ${response.status}: ${body?.error?.message ?? "unknown error"}`);
  }
  return body;
}

// Для видео и рилсов media_url — это mp4, в <img> он не встанет: берём обложку.
// У карусели первым слайдом может оказаться видео — тогда ищем первую картинку
// среди детей, а если картинок нет, обложку первого видео.
function pickImage(media) {
  if (media.media_type === "IMAGE") return media.media_url;
  if (media.media_type === "VIDEO") return media.thumbnail_url;
  const children = media.children?.data ?? [];
  const image = children.find((child) => child.media_type === "IMAGE");
  if (image) return image.media_url;
  return children[0]?.thumbnail_url ?? media.thumbnail_url ?? media.media_url;
}

const me = await api("me", { fields: "username" });
const { data = [] } = await api("me/media", {
  fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}",
  limit,
});

await mkdir(IMAGE_DIR, { recursive: true });

const posts = [];
for (const media of data.slice(0, limit)) {
  const source = pickImage(media);
  if (!source) continue;
  const file = `${media.id}.jpg`;
  const target = path.join(IMAGE_DIR, file);
  const existing = await readFile(target).catch(() => null);
  // Пост в Instagram не меняет картинку после публикации: уже скачанную не
  // тянем повторно, иначе каждый прогон давал бы бинарный дифф и пустой коммит.
  if (!existing) {
    const response = await fetch(source);
    if (!response.ok) {
      console.warn(`Картинка поста ${media.id} не скачалась (${response.status}) — пост пропущен.`);
      continue;
    }
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
  }
  posts.push({
    id: media.id,
    permalink: media.permalink,
    caption: (media.caption ?? "").trim(),
    timestamp: media.timestamp,
    mediaType: media.media_type,
    image: `instagram/${file}`,
  });
}

// Подчищаем картинки постов, которые выпали из выборки (или удалены в Instagram).
const keep = new Set(posts.map((post) => `${post.id}.jpg`));
for (const file of await readdir(IMAGE_DIR)) {
  if (file.endsWith(".jpg") && !keep.has(file)) await rm(path.join(IMAGE_DIR, file));
}

// Без метки времени синхронизации: файл меняется только когда меняются посты,
// и workflow коммитит и пересобирает сайт только тогда.
const feed = { username: me.username, profile: `https://www.instagram.com/${me.username}/`, posts };
const next = `${JSON.stringify(feed, null, 2)}\n`;
const previous = await readFile(FEED_FILE, "utf8").catch(() => "");
if (previous === next) {
  console.log(`Без изменений: ${posts.length} постов @${me.username}.`);
} else {
  await writeFile(FEED_FILE, next);
  console.log(`Обновлено: ${posts.length} постов @${me.username}.`);
}
