import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { checkHref, checkMediaPath, validateGallery, validateSiteContent } from "./schema.ts";

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

test("checkMediaPath: пропускает файлы из media/, uploads/, instagram/", () => {
  for (const ok of ["media/hero.webp", "uploads/3f9a1c.jpg", "instagram/archive/post_1.v2-x.mp4"]) {
    assert.equal(checkMediaPath(ok), null, ok);
  }
});

test("checkMediaPath: отказ на внешние, абсолютные и выходящие из public пути", () => {
  const bad = [
    "",
    "https://evil.example/x.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "//evil.example/x.jpg",
    "/media/hero.webp",
    "media/../../etc/passwd",
    "uploads/./x.jpg",
    "media\\hero.webp",
    "media//hero.webp",
    "media/hero.webp?x=1",
    "components/assets/logo.png",
    "media",
    "instagram/archive/a b.mp4",
    'media/x").evil("',
    "media/x'y.webp",
    "media/фото.webp",
    "uploads/a;b.jpg",
  ];
  for (const value of bad) assert.notEqual(checkMediaPath(value), null, value);
});

test("site и gallery: недопустимые пути попадают в список ошибок", () => {
  const content = site();
  content.hero.image.src = "https://evil.example/x.jpg";
  content.fuscum.image.src = "media/../secret.webp";
  const siteErrors = validateSiteContent(content);
  assert.equal(siteErrors.length, 2);
  assert.match(siteErrors[0], /^hero\.image\.src: /);
  assert.match(siteErrors[1], /^fuscum\.image\.src: /);

  const items = gallery();
  items[0].src = "/instagram/x.webp";
  items[1].poster = "../x.webp";
  items[2].poster = "";
  const galleryErrors = validateGallery(items);
  assert.equal(galleryErrors.length, 2);
  assert.match(galleryErrors[0], /^gallery\[0\]\.src: /);
  assert.match(galleryErrors[1], /^gallery\[1\]\.poster: /);
});

test("checkHref: допустимые ссылки", () => {
  for (const ok of [
    "https://www.instagram.com/sphagnum_eco/",
    "http://example.com",
    "HTTPS://EXAMPLE.COM",
    "mailto:info@example.com",
    "tel:+79990000000",
    "#contact",
    "/catalog",
    "./price.pdf",
    "media/price.pdf",
  ]) {
    assert.equal(checkHref(ok), null, ok);
  }
});

test("checkHref: опасные и чужие схемы отклоняются", () => {
  for (const bad of [
    "",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com",
    "//evil.example",
  ]) {
    assert.notEqual(checkHref(bad), null, JSON.stringify(bad));
  }
});

test("site: все поля-ссылки проверяются", () => {
  const content = site();
  content.strip.intro.linkHref = "javascript:alert(1)";
  content.gallery.profileUrl = "data:text/html,x";
  content.nav.links[0].target = "javascript:alert(1)";
  content.nav.links[1].target = "#applications";
  const errors = validateSiteContent(content);
  assert.equal(errors.length, 4, errors.join("\n"));
  assert.match(errors[0], /^nav\.links\[0\]\.target: /);
  assert.match(errors[1], /^nav\.links\[1\]\.target: /);
  assert.match(errors[2], /^strip\.intro\.linkHref: /);
  assert.match(errors[3], /^gallery\.profileUrl: /);
});
