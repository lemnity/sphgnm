import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { validateGallery, validateSiteContent } from "./schema.ts";

const readJson = (name: string) => JSON.parse(readFileSync(new URL(`../../content/${name}`, import.meta.url), "utf8"));
// Каждый тест портит свою копию.
const site = () => readJson("site.json");
const gallery = () => readJson("gallery.json");

test("текущий site.json проходит проверку", () => {
  assert.deepEqual(validateSiteContent(site()), []);
});

test("текущий gallery.json проходит проверку", () => {
  assert.deepEqual(validateGallery(gallery()), []);
});

test("site: не объект", () => {
  assert.deepEqual(validateSiteContent(null), ["site: ожидается объект"]);
  assert.deepEqual(validateSiteContent([]), ["site: ожидается объект"]);
});

test("site: нет обязательного блока или поля", () => {
  const withoutBlock = site();
  delete withoutBlock.faq;
  assert.deepEqual(validateSiteContent(withoutBlock), ["faq: нет обязательного поля"]);

  const withoutField = site();
  delete withoutField.hero.subtitle;
  assert.deepEqual(validateSiteContent(withoutField), ["hero.subtitle: нет обязательного поля"]);
});

test("site: не тот тип", () => {
  const content = site();
  content.meta.title = 42;
  content.hero.bullets = "одной строкой";
  content.faq.items[1].answer = null;
  content.applications.items = {};
  assert.deepEqual(validateSiteContent(content), [
    "meta.title: ожидается строка",
    "hero.bullets: ожидается список",
    "applications.items: ожидается список",
    "faq.items[1].answer: ожидается строка",
  ]);
});

test("site: ошибка внутри элемента списка указывает на элемент", () => {
  const content = site();
  delete content.product.solutions[0].features;
  content.product.solutions[1].features[2] = 7;
  assert.deepEqual(validateSiteContent(content), [
    "product.solutions[0].features: нет обязательного поля",
    "product.solutions[1].features[2]: ожидается строка",
  ]);
});

test("site: неизвестная иконка", () => {
  const content = site();
  content.strip.cards[0].icon = "rocket";
  assert.deepEqual(validateSiteContent(content), ["strip.cards[0].icon: неизвестная иконка «rocket»"]);
});

test("site: пустые строки и пустые списки допустимы", () => {
  const content = site();
  content.hero.subtitle = "";
  content.faq.items = [];
  assert.deepEqual(validateSiteContent(content), []);
});

test("gallery: не список", () => {
  assert.deepEqual(validateGallery({}), ["gallery: ожидается список"]);
});

test("gallery: нет обязательного поля и не тот тип", () => {
  const items = gallery();
  delete items[0].src;
  items[1].title = 5;
  items[2].type = "audio";
  items[3].poster = 1;
  assert.deepEqual(validateGallery(items), [
    "gallery[0].src: ожидается строка",
    "gallery[1].title: ожидается строка",
    'gallery[2].type: ожидается "image" или "video"',
    "gallery[3].poster: ожидается строка",
  ]);
});

test("gallery: дата не в формате YYYY-MM-DD", () => {
  const items = gallery();
  items[0].date = "07.08.2025";
  assert.deepEqual(validateGallery(items), ["gallery[0].date: ожидается дата YYYY-MM-DD"]);
});

test("gallery: повторяющийся и пустой id", () => {
  const items = gallery();
  items[1].id = items[0].id;
  items[2].id = "";
  assert.deepEqual(validateGallery(items), [`gallery[1].id: повторяется «${items[0].id}»`, "gallery[2].id: пустой id"]);
});

test("gallery: элемент не объект", () => {
  assert.deepEqual(validateGallery(["строка"]), ["gallery[0]: ожидается объект"]);
});

test("site: у картинок обязателен непустой src", () => {
  const content = site();
  delete content.hero.image.src;
  content.fuscum.image.src = "  ";
  content.applications.items[0].image.src = 5;
  assert.deepEqual(validateSiteContent(content), [
    "hero.image.src: нет обязательного поля",
    "fuscum.image.src: пустой путь",
    "applications.items[0].image.src: ожидается путь к файлу",
  ]);
});

test("site: фразы загрузчика — список строк", () => {
  const content = site();
  content.loader.phrases = "одна";
  assert.deepEqual(validateSiteContent(content), ["loader.phrases: ожидается список"]);
});

test("site: все картинки из site.json лежат в public", () => {
  const paths: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") {
      const record = node as Record<string, unknown>;
      if (typeof record.src === "string") paths.push(record.src);
      Object.values(record).forEach(walk);
    }
  };
  walk(site());
  assert.ok(paths.length >= 9);
  for (const path of paths) assert.ok(existsSync(new URL(`../../public/${path}`, import.meta.url)), `нет файла public/${path}`);
});
