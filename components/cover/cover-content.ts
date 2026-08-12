/**
 * Тексты обложки. Держим отдельно от разметки — правка копирайта не должна
 * трогать JSX (та же логика, что в sphagnum-data.ts).
 *
 * Язык — английский: лендинг одноязычный, целевой рынок ОАЭ/КСА (см. lang="en"
 * в app/layout.tsx). ТЗ на анимацию приводило примеры показателей по-русски
 * («500+ проектов»), но подставлять их в текст было бы ошибкой — рядом стоит
 * английский заголовок.
 */

export const COVER_EYEBROW = "Live Sphagnum Fuscum · Vertical Systems";

/**
 * Заголовок разбит на строки вручную, а не отдан на откуп переносу.
 *
 * Причина: у обложки фиксированная высота экрана, и «плавающее» число строк
 * (2 на широком мониторе, 4 на ноутбуке) ломало бы вертикальный ритм —
 * счётчики уезжали бы под сгиб. Ручная разбивка даёт предсказуемый блок,
 * а на узком экране строки всё равно схлопываются по мере надобности.
 */
export const COVER_TITLE_LINES = ["A wall that", "is actually", "alive"] as const;

export const COVER_LEAD =
  "Hand-harvested living moss engineered into vertical systems that hold their own in heat, drought and rooftop load limits — without irrigation lines or synthetic backing.";

/** Преимущества. Три — сознательно: четвёртое уже не читается на первом экране. */
export const COVER_BENEFITS = [
  "Absorbs 20–25× its weight in water",
  "12–16× lighter than soil substrate",
  "Naturally antimicrobial, untreated",
] as const;

export const COVER_CTA = { label: "Get Expert Advice", href: "#contact" } as const;

/**
 * ⚠ ПОКАЗАТЕЛИ — ПЛЕЙСХОЛДЕРЫ, ТРЕБУЮТ ПОДТВЕРЖДЕНИЯ.
 *
 * Числа взяты из примера в ТЗ на анимацию («500+ проектов», «12 лет опыта»,
 * «1500 м² фитостен») и НЕ имеют источника в брифе. Файл sphagnum-data.ts
 * прямо требует: непроверенные конкретные заявления на коммерческой странице
 * не публикуются без письменного источника.
 *
 * Механика счётчика от этого не зависит — подставьте реальные значения в
 * `value`, и всё продолжит работать. До тех пор блок стоит показывать только
 * на демо-сборке.
 */
export const COVER_STATS = [
  { value: 500, suffix: "+", label: "Projects delivered" },
  { value: 12, suffix: "", label: "Years of expertise" },
  { value: 1500, suffix: " m²", label: "Living wall installed" },
] as const;

export const COVER_SCROLL_HINT = "Scroll to grow";
