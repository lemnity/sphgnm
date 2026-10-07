// Серверное чтение контента из content/. Только для серверных компонентов и API.
import { readFileSync } from "node:fs";
import path from "node:path";
import { validateGallery, validateSiteContent, type GalleryItem, type SiteContent } from "./schema.ts";

export const CONTENT_DIR = path.join(process.cwd(), "content");

/** Живые посты, которые пишет scripts/sync-instagram.mjs. Пока их нет, галерея берёт content/gallery.json. */
export type InstagramPost = {
  id: string;
  permalink: string;
  caption: string;
  timestamp: string;
  mediaType: string;
  image: string;
  video?: string;
};

const INSTAGRAM_FEED_FILE = path.join(process.cwd(), "components/instagram-feed.json");

function readJson(file: string): unknown {
  const name = path.relative(process.cwd(), file);
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    throw new Error(`Не удалось прочитать ${name}: ${(error as Error).message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name}: невалидный JSON — ${(error as Error).message}`);
  }
}

// Битый файл должен ронять сборку с понятным списком, а не страницу с undefined посреди вёрстки.
function assertValid(name: string, errors: string[]) {
  if (errors.length > 0) throw new Error(`${name}: ошибки в структуре\n${errors.map((error) => `  - ${error}`).join("\n")}`);
}

export function getSiteContent(): SiteContent {
  const data = readJson(path.join(CONTENT_DIR, "site.json"));
  assertValid("content/site.json", validateSiteContent(data));
  return data as SiteContent;
}

export function getGallery(): GalleryItem[] {
  const data = readJson(path.join(CONTENT_DIR, "gallery.json"));
  assertValid("content/gallery.json", validateGallery(data));
  return data as GalleryItem[];
}

export function getInstagramPosts(): InstagramPost[] {
  const feed = readJson(INSTAGRAM_FEED_FILE) as { posts?: InstagramPost[] };
  return Array.isArray(feed.posts) ? feed.posts : [];
}
