import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ICON_NAMES, SITE_SHAPE, validateSiteContent } from "../content/schema.ts";
import {
  BLOCKS,
  ICON_LABELS,
  allLabels,
  blockLeaves,
  describePath,
  describeUsage,
  emptyObject,
  newListItem,
  parseApiError,
  shapeLeaves,
  splitPath,
  type Field,
} from "./fields.ts";

const site = JSON.parse(readFileSync(new URL("../../content/site.json", import.meta.url), "utf8"));

test("поля редактора покрывают каждое поле схемы site.json, и с тем же типом", () => {
  const fromShape = shapeLeaves(SITE_SHAPE).sort();
  const fromFields = blockLeaves().sort();
  const missing = fromShape.filter((leaf) => !fromFields.includes(leaf));
  const extra = fromFields.filter((leaf) => !fromShape.includes(leaf));
  assert.deepEqual(missing, [], "в fields.ts нет полей (или у них другой тип)");
  assert.deepEqual(extra, [], "в fields.ts есть поля, которых нет в схеме");
});

test("каждый блок схемы есть в кабинете ровно один раз", () => {
  const ids = BLOCKS.map((block) => block.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), Object.keys(SITE_SHAPE).sort());
});

test("сверка ловит пропущенное поле", () => {
  const trimmed = BLOCKS.map((block) =>
    block.id === "hero" ? { ...block, fields: block.fields.filter((field) => field.key !== "subtitle") } : block,
  );
  assert.ok(!blockLeaves(trimmed).includes("hero.subtitle:string"));
  assert.ok(shapeLeaves(SITE_SHAPE).includes("hero.subtitle:string"));
});

test("у каждой иконки есть подпись", () => {
  assert.deepEqual(Object.keys(ICON_LABELS).sort(), [...ICON_NAMES].sort());
});

test("у полей есть русские подписи, ключи в группе не повторяются", () => {
  const walk = (fields: Field[], at: string) => {
    const keys = fields.map((field) => field.key);
    assert.equal(new Set(keys).size, keys.length, `повтор ключа в ${at}`);
    for (const field of fields) {
      assert.match(field.label.ru, /[а-яё]|FAQ|SEO/i, `${at}.${field.key}: нет подписи`);
      if (field.kind === "group") walk(field.fields, `${at}.${field.key}`);
      if (field.kind === "list" && typeof field.item !== "string") walk(field.item, `${at}.${field.key}[]`);
    }
  };
  for (const block of BLOCKS) walk(block.fields, block.id);
});

test("пустой блок, собранный по описанию, проходит схему, кроме обязательных картинок", () => {
  const empty = Object.fromEntries(BLOCKS.map((block) => [block.id, emptyObject(block.fields)]));
  const errors = validateSiteContent(empty);
  assert.ok(errors.length > 0);
  // Ругаться можно только на пустые пути картинок и пустую ссылку — остальное заполнено по форме.
  for (const error of errors) assert.match(error, /\.src: пустой путь|: пустая ссылка|target|siteUrl: «»/, error);
});

test("новый элемент списка: объект по полям или пустая строка", () => {
  const product = BLOCKS.find((block) => block.id === "product")!;
  const solutions = product.fields.find((field) => field.key === "solutions");
  assert.ok(solutions && solutions.kind === "list");
  assert.deepEqual(newListItem(solutions), {
    icon: "moss",
    kicker: "",
    title: "",
    lead: "",
    features: [],
    image: { src: "", alt: "" },
  });
  const hero = BLOCKS.find((block) => block.id === "hero")!;
  const bullets = hero.fields.find((field) => field.key === "bullets");
  assert.ok(bullets && bullets.kind === "list");
  assert.equal(newListItem(bullets), "");
  // Текущий контент валиден — значит, форма элементов совпадает с реальными данными.
  assert.deepEqual(validateSiteContent(site), []);
});

test("parseApiError: путь, файл и текст", () => {
  assert.deepEqual(parseApiError("hero.title: ожидается строка"), { file: "site", path: "hero.title", message: "ожидается строка" });
  assert.deepEqual(parseApiError("gallery.title: ожидается строка"), { file: "site", path: "gallery.title", message: "ожидается строка" });
  assert.deepEqual(parseApiError("gallery[3].src: «x»: недопустимый путь"), {
    file: "gallery",
    path: "gallery[3].src",
    message: "«x»: недопустимый путь",
  });
  assert.deepEqual(parseApiError("site: ожидается объект"), { file: "site", path: "", message: "ожидается объект" });
});

test("splitPath и describePath", () => {
  assert.deepEqual(splitPath("product.solutions[0].image.src"), ["product", "solutions", 0, "image", "src"]);
  assert.deepEqual(describePath("site", "product.solutions[0].image.src"), {
    blockId: "product",
    label: "Продукты › Решения › Решение № 1 › Картинка › файл",
  });
  assert.equal(describePath("site", "contact.form.projectTypes[2]").label, "Заявка › Поля формы › Типы проектов › Тип № 3");
  assert.equal(describePath("site", "hero").label, "Первый экран");
  assert.deepEqual(describePath("gallery", "gallery[4].poster"), { blockId: "gallery", label: "Галерея › Элемент № 5 › постер" });
  assert.equal(describePath("site", "nope.x").blockId, null);
});

test("describeUsage: ответ 409 при удалении файла", () => {
  assert.equal(describeUsage("site: hero.image.src"), "Первый экран › Фоновая картинка › файл");
  assert.equal(describeUsage("gallery: [0].src"), "Галерея › Элемент № 1 › файл");
});

test("у каждой подписи и подсказки есть оба языка, английский — не копия русского", () => {
  const labels = allLabels();
  assert.ok(labels.length > 200, `подписей всего ${labels.length}`);
  for (const { at, text } of labels) {
    assert.ok(text.ru.trim(), `${at}: нет русского текста`);
    assert.ok(text.en.trim(), `${at}: нет английского текста`);
    assert.doesNotMatch(text.en, /[а-яё]/i, `${at}: кириллица в английском тексте`);
    if (/[а-яё]/i.test(text.ru)) assert.notEqual(text.en, text.ru, `${at}: перевод совпадает с русским`);
  }
});

test("describePath и describeUsage по-английски", () => {
  assert.equal(describePath("site", "product.solutions[0].image.src", "en").label, "Products › Solutions › Solution #1 › Image › file");
  assert.equal(describePath("site", "contact.form.projectTypes[2]", "en").label, "Enquiry › Form fields › Project types › Type #3");
  assert.equal(describePath("gallery", "gallery[4].poster", "en").label, "Gallery › Item #5 › poster");
  assert.equal(describeUsage("site: hero.image.src", "en"), "Hero › Background image › file");
  assert.equal(describePath("site", "meta.siteUrl", "en").label, "SEO › Site address");
});
