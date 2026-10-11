import { test } from "node:test";
import assert from "node:assert/strict";
import { iconWithImage, resolveIcon, sectionBackground } from "./render.ts";

test("resolveIcon: строка, объект и нет поля", () => {
  assert.deepEqual(resolveIcon("droplet", "moss"), { name: "droplet", src: "" });
  assert.deepEqual(resolveIcon({ name: "droplet", src: "uploads/a.png" }, "moss"), { name: "droplet", src: "uploads/a.png" });
  assert.deepEqual(resolveIcon({ name: "droplet", src: "" }, "moss"), { name: "droplet", src: "" });
  assert.deepEqual(resolveIcon(undefined, "checkCircle"), { name: "checkCircle", src: "" });
});

test("iconWithImage: без картинки — снова строка, как в старом контенте", () => {
  assert.equal(iconWithImage("moss", ""), "moss");
  assert.deepEqual(iconWithImage("moss", "uploads/a.png"), { name: "moss", src: "uploads/a.png" });
});

test("sectionBackground: нет картинки — фон из вёрстки не трогаем", () => {
  assert.equal(sectionBackground(undefined, "1, 2, 3"), null);
  assert.equal(sectionBackground({ src: "", overlay: 60 }, "1, 2, 3"), null);
});

test("sectionBackground: картинка cover по центру, заливка цветом секции", () => {
  assert.deepEqual(sectionBackground({ src: "uploads/bg.webp", overlay: 0 }, "1, 2, 3"), {
    backgroundImage: 'url("/uploads/bg.webp")',
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  });
  assert.equal(
    sectionBackground({ src: "uploads/bg.webp", overlay: 40 }, "16, 43, 32")?.backgroundImage,
    'linear-gradient(rgba(16, 43, 32, 0.4), rgba(16, 43, 32, 0.4)), url("/uploads/bg.webp")',
  );
  assert.match(sectionBackground({ src: "media/a.jpg", overlay: 100 }, "0, 0, 0")!.backgroundImage, /rgba\(0, 0, 0, 1\)/);
});
