// Синхронизация блока «Global portfolios» с Instagram @sphagnum_eco.
//
// Анонимно Instagram посты не отдаёт (web_profile_info → 401 require_login,
// embed-страница без данных), поэтому ходим в официальный Instagram API
// (Instagram Login, graph.instagram.com) с долгоживущим токеном аккаунта.
//
// Что делает:
//   1. берёт последние INSTAGRAM_LIMIT постов (по умолчанию 18) для галереи блока;
//   2. скачивает картинки в public/instagram/<id>.jpg, а для видео и рилсов —
//      ещё и ролик <id>.mp4 (обложка остаётся постером). Ссылки CDN Instagram
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
const limit = Number(process.env.INSTAGRAM_LIMIT || 18);
const API = "https://graph.instagram.com/v23.0";
// Ролики тяжелее картинок и копятся в истории git: слишком большой не качаем,
// в карточке тогда останется обложка со ссылкой на пост.
const MAX_VIDEO_BYTES = Number(process.env.INSTAGRAM_MAX_VIDEO_MB || 20) * 1024 * 1024;

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

// Ролик поста: у видео это media_url, у карусели — первый слайд, если он видео.
function pickVideo(media) {
  if (media.media_type === "VIDEO") return media.media_url;
  if (media.media_type === "CAROUSEL_ALBUM") {
    const first = media.children?.data?.[0];
    if (first?.media_type === "VIDEO") return first.media_url;
  }
  return null;
}

async function download(url, target) {
  const existing = await readFile(target).catch(() => null);
  // Медиа поста после публикации не меняется: уже скачанное не тянем повторно,
  // иначе каждый прогон давал бы бинарный дифф и пустой коммит.
  if (existing) return true;
  const response = await fetch(url);
  if (!response.ok) return false;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (target.endsWith(".mp4") && buffer.length > MAX_VIDEO_BYTES) {
    console.warn(`Ролик ${path.basename(target)} больше лимита (${(buffer.length / 1048576).toFixed(1)} МБ) — оставляем обложку.`);
    return false;
  }
  await writeFile(target, buffer);
  return true;
}

// Для видео и рилсов media_url — это mp4, в <img> он не встанет: берём обложку,
// она же постер ролика. Если карусель начинается с видео — обложка этого видео,
// иначе первая картинка карусели.
function pickImage(media) {
  if (media.media_type === "IMAGE") return media.media_url;
  if (media.media_type === "VIDEO") return media.thumbnail_url;
  const children = media.children?.data ?? [];
  if (children[0]?.media_type === "VIDEO") return children[0].thumbnail_url ?? media.thumbnail_url;
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
  if (!(await download(source, path.join(IMAGE_DIR, file)))) {
    console.warn(`Картинка поста ${media.id} не скачалась — пост пропущен.`);
    continue;
  }
  const videoSource = pickVideo(media);
  const videoFile = `${media.id}.mp4`;
  const hasVideo = videoSource ? await download(videoSource, path.join(IMAGE_DIR, videoFile)) : false;
  posts.push({
    id: media.id,
    permalink: media.permalink,
    caption: (media.caption ?? "").trim(),
    timestamp: media.timestamp,
    mediaType: media.media_type,
    image: `instagram/${file}`,
    ...(hasVideo ? { video: `instagram/${videoFile}` } : {}),
  });
}

// Подчищаем медиа постов, которые выпали из выборки (или удалены в Instagram).
const keep = new Set(posts.flatMap((post) => [post.image, post.video].filter(Boolean).map((file) => path.basename(file))));
for (const file of await readdir(IMAGE_DIR)) {
  if (/\.(jpg|mp4)$/.test(file) && !keep.has(file)) await rm(path.join(IMAGE_DIR, file));
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
