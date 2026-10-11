// Помощники отрисовки контента: иконка (встроенная или своя картинка) и фон секции.
// Без React и без алиаса @/ — их гоняет node --test.
import { withBase } from "../media.ts";
import type { IconName, IconRef, SectionBackground } from "./schema.ts";

/** Иконка из контента → ключ встроенной и путь своей картинки ("" — рисуем встроенную). */
export function resolveIcon(ref: IconRef | undefined, fallback: IconName): { name: IconName; src: string } {
  if (ref === undefined) return { name: fallback, src: "" };
  if (typeof ref === "string") return { name: ref, src: "" };
  return { name: ref.name, src: ref.src };
}

/** Своя картинка → значение поля; пустой путь — обратно строка, как в старом контенте. */
export function iconWithImage(name: IconName, src: string): IconRef {
  return src ? { name, src } : name;
}

/** Инлайн-стиль фона секции. Нет картинки — null: остаётся фон из вёрстки как есть. */
export type BackgroundStyle = {
  backgroundImage: string;
  backgroundSize: "cover";
  backgroundPosition: "center";
  backgroundRepeat: "no-repeat";
};

/**
 * tint — цвет секции "r, g, b": им заливается картинка на overlay % (0 — картинка как есть),
 * чтобы текст поверх оставался читаемым.
 */
export function sectionBackground(background: SectionBackground | undefined, tint: string): BackgroundStyle | null {
  if (!background?.src) return null;
  const alpha = Math.min(100, Math.max(0, Math.round(background.overlay || 0))) / 100;
  const layers = [`url("${withBase(background.src)}")`];
  if (alpha > 0) layers.unshift(`linear-gradient(rgba(${tint}, ${alpha}), rgba(${tint}, ${alpha}))`);
  return { backgroundImage: layers.join(", "), backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" };
}
