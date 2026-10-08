import assert from "node:assert/strict";
import { test } from "node:test";
import { absoluteUrl, imageType, siteRoot } from "./seo.ts";

test("адрес превью: подпапка из siteUrl не теряется и не задваивается", () => {
  assert.equal(siteRoot("https://lemnity.github.io/sphgnm"), "https://lemnity.github.io/sphgnm/");
  assert.equal(siteRoot("https://lemnity.github.io/sphgnm/"), "https://lemnity.github.io/sphgnm/");
  assert.equal(absoluteUrl("https://lemnity.github.io/sphgnm", "media/hero.webp"), "https://lemnity.github.io/sphgnm/media/hero.webp");
  assert.equal(absoluteUrl("https://lemnity.github.io/sphgnm/", "/uploads/a.jpg"), "https://lemnity.github.io/sphgnm/uploads/a.jpg");
  assert.equal(absoluteUrl("https://sphagnum.eco", "media/hero.webp"), "https://sphagnum.eco/media/hero.webp");
});

test("тип превью по расширению", () => {
  assert.equal(imageType("uploads/a.JPG"), "image/jpeg");
  assert.equal(imageType("media/hero.webp"), "image/webp");
  assert.equal(imageType("media/noext"), undefined);
});
