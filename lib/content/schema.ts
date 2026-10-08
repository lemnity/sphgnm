// Типы контента сайта и структурная проверка JSON из content/.
// Модуль без зависимостей и без алиаса @/: его гоняет `node --test` напрямую.

/** Ключи иконок, которые умеет рисовать лендинг (карта ICONS в components/site-icons.ts). */
export const ICON_NAMES = [
  "droplet",
  "wind",
  "sprout",
  "sun",
  "weight",
  "moss",
  "roof",
  "battery",
  "shield",
  "recycle",
  "layers",
  "porosity",
  "stable",
  "temperature",
  "factory",
  "flask",
  "headset",
  "circleOff",
  "flower",
  "globe",
  "hand",
  "layers3",
  "refresh",
  "shovel",
  "star",
  "thermometerSun",
  "waves",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** Картинка блока. src — путь от public без ведущего слэша («media/…», «uploads/…»). */
export type ImageRef = { src: string; alt: string };

export type IconText = { icon: IconName; title: string; text: string };

export type SiteContent = {
  /** siteUrl — публичный адрес сайта (для абсолютных ссылок Open Graph), image — превью при пересылке ссылки. */
  meta: { title: string; description: string; shareDescription: string; siteUrl: string; image: ImageRef };
  contacts: { person: string; role: string; phone: string; email: string };
  nav: {
    /** target — id секции на странице, без решётки. */
    links: { label: string; target: string }[];
    ctaLabel: string;
    openMenuLabel: string;
    closeMenuLabel: string;
  };
  hero: { title: string; subtitle: string; ctaLabel: string; bullets: string[]; image: ImageRef };
  strip: {
    intro: { text: string; linkLabel: string; linkHref: string };
    cards: { icon: IconName; text: string }[];
    fact: { value: string; text: string };
  };
  product: {
    kicker: string;
    title: string;
    lead: string;
    featuresLabel: string;
    /** В title перенос строки (\n) — место принудительного переноса в заголовке карточки. */
    solutions: { icon: IconName; kicker: string; title: string; lead: string; features: string[]; image: ImageRef }[];
  };
  fuscum: { kicker: string; areaValue: string; areaUnit: string; areaCaption: string; image: ImageRef };
  wetland: { text: string; facts: { icon: IconName; value: string; text: string }[]; wallImage: ImageRef };
  platform: {
    kicker: string;
    title: string;
    lead: string;
    pillars: IconText[];
    rootZoneImage: ImageRef;
    benefitsTitle: string;
    benefits: IconText[];
    rangeTitle: string;
    range: { icon: IconName; name: string; text: string }[];
    ctaLabel: string;
  };
  gallery: {
    kicker: string;
    /** Заголовок выводится как «title titleAccent», вторая часть — золотом. */
    title: string;
    titleAccent: string;
    username: string;
    profileUrl: string;
    followLabel: string;
    showMoreLabel: string;
    showLessLabel: string;
    openLabel: string;
    viewOnInstagramLabel: string;
    closeLabel: string;
    previousLabel: string;
    nextLabel: string;
  };
  applications: {
    kicker: string;
    title: string;
    itemKicker: string;
    /** У преимущества text может быть пустым — тогда выводится только заголовок. */
    items: { title: string; text: string; image: ImageRef; benefits: IconText[] }[];
  };
  advantages: {
    kicker: string;
    title: string;
    titleAccent: string;
    lead: string;
    items: IconText[];
    tags: { icon: IconName; label: string }[];
  };
  faq: { kicker: string; title: string; items: { question: string; answer: string }[] };
  contact: {
    kicker: string;
    title: string;
    lead: string;
    deliverables: { title: string; text: string }[];
    formTitle: string;
    formLead: string;
    consent: string;
    form: {
      ariaLabel: string;
      nameLabel: string;
      emailLabel: string;
      phoneLabel: string;
      regionLabel: string;
      projectTypeLabel: string;
      projectTypePlaceholder: string;
      projectTypes: string[];
      areaLabel: string;
      messageLabel: string;
      messageHint: string;
      submitLabel: string;
      successMessage: string;
    };
  };
  footer: { copyright: string };
  /** Экран загрузки: label — aria-метка, srLabel — скрытая подпись, phrases — бегущие фразы. */
  loader: { label: string; srLabel: string; phrases: string[] };
};

/** Элемент галереи. Пути — относительно public, без ведущего слэша. date — YYYY-MM-DD. */
export type GalleryItem = {
  id: string;
  type: "image" | "video";
  src: string;
  /** Постер ролика; у картинок не нужен. */
  poster?: string;
  title: string;
  date: string;
};

/* Описание формы site.json для проверки. Держать в паре с типом SiteContent:
   тест прогоняет через него настоящий content/site.json, так что расхождение
   вылезет сразу. По нему же тест сверяет поля редактора (lib/admin/fields.ts). */
export type Shape = "string" | "path" | "icon" | "href" | "anchor" | "url" | Shape[] | { [key: string]: Shape };

const IMAGE: Shape = { src: "path", alt: "string" };
const ICON_TEXT: Shape = { icon: "icon", title: "string", text: "string" };

export const SITE_SHAPE: Shape = {
  meta: { title: "string", description: "string", shareDescription: "string", siteUrl: "url", image: IMAGE },
  contacts: { person: "string", role: "string", phone: "string", email: "string" },
  nav: {
    links: [{ label: "string", target: "anchor" }],
    ctaLabel: "string",
    openMenuLabel: "string",
    closeMenuLabel: "string",
  },
  hero: { title: "string", subtitle: "string", ctaLabel: "string", bullets: ["string"], image: IMAGE },
  strip: {
    intro: { text: "string", linkLabel: "string", linkHref: "href" },
    cards: [{ icon: "icon", text: "string" }],
    fact: { value: "string", text: "string" },
  },
  product: {
    kicker: "string",
    title: "string",
    lead: "string",
    featuresLabel: "string",
    solutions: [{ icon: "icon", kicker: "string", title: "string", lead: "string", features: ["string"], image: IMAGE }],
  },
  fuscum: { kicker: "string", areaValue: "string", areaUnit: "string", areaCaption: "string", image: IMAGE },
  wetland: { text: "string", facts: [{ icon: "icon", value: "string", text: "string" }], wallImage: IMAGE },
  platform: {
    kicker: "string",
    title: "string",
    lead: "string",
    pillars: [ICON_TEXT],
    rootZoneImage: IMAGE,
    benefitsTitle: "string",
    benefits: [ICON_TEXT],
    rangeTitle: "string",
    range: [{ icon: "icon", name: "string", text: "string" }],
    ctaLabel: "string",
  },
  gallery: {
    kicker: "string",
    title: "string",
    titleAccent: "string",
    username: "string",
    profileUrl: "href",
    followLabel: "string",
    showMoreLabel: "string",
    showLessLabel: "string",
    openLabel: "string",
    viewOnInstagramLabel: "string",
    closeLabel: "string",
    previousLabel: "string",
    nextLabel: "string",
  },
  applications: {
    kicker: "string",
    title: "string",
    itemKicker: "string",
    items: [{ title: "string", text: "string", image: IMAGE, benefits: [ICON_TEXT] }],
  },
  advantages: {
    kicker: "string",
    title: "string",
    titleAccent: "string",
    lead: "string",
    items: [ICON_TEXT],
    tags: [{ icon: "icon", label: "string" }],
  },
  faq: { kicker: "string", title: "string", items: [{ question: "string", answer: "string" }] },
  contact: {
    kicker: "string",
    title: "string",
    lead: "string",
    deliverables: [{ title: "string", text: "string" }],
    formTitle: "string",
    formLead: "string",
    consent: "string",
    form: {
      ariaLabel: "string",
      nameLabel: "string",
      emailLabel: "string",
      phoneLabel: "string",
      regionLabel: "string",
      projectTypeLabel: "string",
      projectTypePlaceholder: "string",
      projectTypes: ["string"],
      areaLabel: "string",
      messageLabel: "string",
      messageHint: "string",
      submitLabel: "string",
      successMessage: "string",
    },
  },
  footer: { copyright: "string" },
  loader: { label: "string", srLabel: "string", phrases: ["string"] },
};

const ICON_SET = new Set<string>(ICON_NAMES);

/* ---------- тексты ошибок ---------- */

/** Язык текстов проверки. Своя копия типа: модуль не тянет словарь кабинета на сайт. */
export type SchemaLang = "ru" | "en";

const SCHEMA_RU = {
  emptyHref: "пустая ссылка",
  hrefSpaces: "«{value}»: пробелы и управляющие символы в ссылке недопустимы",
  hrefNoScheme: "«{value}»: укажите адрес полностью, с https://",
  hrefScheme: "«{value}»: недопустимая ссылка — можно http(s)://, mailto:, tel:, #якорь или путь на сайте",
  emptyPath: "пустой путь",
  pathAbsolute: "«{value}»: нужен относительный путь внутри public",
  pathChars: "«{value}»: недопустимые символы в пути",
  pathInvalid: "«{value}»: недопустимый путь",
  pathLatin: "«{value}»: в имени файла и папок допустимы только латинские буквы, цифры, точка, «_» и «-»",
  pathDir: "«{value}»: файл должен лежать в {dirs}",
  expectString: "ожидается строка",
  expectPath: "ожидается путь к файлу",
  expectHref: "ожидается ссылка",
  expectUrl: "ожидается адрес сайта",
  urlInvalid: "«{value}»: нужен полный адрес сайта, с http:// или https://, без ? и #",
  expectAnchor: "ожидается id секции",
  anchorInvalid: "«{value}» — нужен id секции без решётки: латиница, цифры, - и _",
  expectIcon: "ожидается ключ иконки",
  unknownIcon: "неизвестная иконка «{value}»",
  expectList: "ожидается список",
  expectObject: "ожидается объект",
  missingField: "нет обязательного поля",
  emptyId: "пустой id",
  duplicateId: "повторяется «{value}»",
  expectType: 'ожидается "image" или "video"',
  expectDate: "ожидается дата YYYY-MM-DD",
} as const;

export type SchemaMessageKey = keyof typeof SCHEMA_RU;

export const SCHEMA_MESSAGES: Record<SchemaLang, Record<SchemaMessageKey, string>> = {
  ru: SCHEMA_RU,
  en: {
    emptyHref: "the link is empty",
    hrefSpaces: "“{value}”: links can't contain spaces or control characters",
    hrefNoScheme: "“{value}”: enter the full address, starting with https://",
    hrefScheme: "“{value}”: this link isn't allowed — use http(s)://, mailto:, tel:, a #anchor or a path on the site",
    emptyPath: "the path is empty",
    pathAbsolute: "“{value}”: must be a relative path inside public",
    pathChars: "“{value}”: the path contains characters that aren't allowed",
    pathInvalid: "“{value}”: invalid path",
    pathLatin: "“{value}”: file and folder names may only contain Latin letters, digits, dots, “_” and “-”",
    pathDir: "“{value}”: the file must be in {dirs}",
    expectString: "must be text",
    expectPath: "must be a file path",
    expectHref: "must be a link",
    expectUrl: "must be the site address",
    urlInvalid: "“{value}”: enter the full site address, starting with http:// or https://, without ? or #",
    expectAnchor: "must be a section id",
    anchorInvalid: "“{value}” — enter a section id without the #: Latin letters, digits, - and _",
    expectIcon: "must be an icon key",
    unknownIcon: "unknown icon “{value}”",
    expectList: "must be a list",
    expectObject: "must be an object",
    missingField: "required field is missing",
    emptyId: "the id is empty",
    duplicateId: "duplicate id “{value}”",
    expectType: 'must be "image" or "video"',
    expectDate: "must be a date in YYYY-MM-DD format",
  },
};

function msg(lang: SchemaLang, key: SchemaMessageKey, params: Record<string, string> = {}): string {
  return SCHEMA_MESSAGES[lang][key].replace(/\{(\w+)\}/g, (whole, name: string) => params[name] ?? whole);
}

/* Ссылка из контента в href. Разрешены http(s), mailto, tel, якорь "#…" и относительные
   пути; javascript:, data:, vbscript: и любые другие схемы — нет. Пробелы и управляющие
   символы запрещены целиком: браузер вырезает их из схемы ("java\tscript:" сработает). */
export function checkHref(value: string, lang: SchemaLang = "ru"): string | null {
  if (!value) return msg(lang, "emptyHref");
  if (/[\u0000-\u0020\u007f]/.test(value)) return msg(lang, "hrefSpaces", { value });
  if (value.startsWith("//")) return msg(lang, "hrefNoScheme", { value });
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (scheme && !["http", "https", "mailto", "tel"].includes(scheme[1].toLowerCase())) {
    return msg(lang, "hrefScheme", { value });
  }
  return null;
}

/* Публичный адрес сайта: абсолютный http(s) без query и hash. */
export function checkSiteUrl(value: string, lang: SchemaLang = "ru"): string | null {
  let url: URL | null = null;
  try {
    url = /^https?:\/\/[^\s/?#]+/i.test(value) && !/[\s?#]/.test(value) ? new URL(value) : null;
  } catch {
    url = null;
  }
  return url ? null : msg(lang, "urlInvalid", { value });
}

/* id секции на странице: в разметке становится "#<id>". */
const ANCHOR_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Папки в public, из которых контент может брать файлы. */
export const MEDIA_DIRS = ["media", "uploads", "instagram"] as const;

/* Путь к файлу из public: только относительный и только внутри MEDIA_DIRS.
   Без этого через админку можно подставить внешний URL, javascript: или выйти
   из public через "..". Возвращает текст ошибки или null. */
export function checkMediaPath(value: string, lang: SchemaLang = "ru"): string | null {
  if (!value.trim()) return msg(lang, "emptyPath");
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("/") || value.includes("\\")) {
    return msg(lang, "pathAbsolute", { value });
  }
  if (/[\u0000-\u001f?#]/.test(value)) return msg(lang, "pathChars", { value });
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return msg(lang, "pathInvalid", { value });
  }
  // Путь попадает в CSS url("…") и атрибуты: только латиница, цифры, точка, _ и -.
  if (segments.some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment))) {
    return msg(lang, "pathLatin", { value });
  }
  if (segments.length < 2 || !(MEDIA_DIRS as readonly string[]).includes(segments[0])) {
    return msg(lang, "pathDir", { value, dirs: MEDIA_DIRS.map((dir) => `${dir}/`).join(", ") });
  }
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function check(value: unknown, shape: Shape, path: string, errors: string[], lang: SchemaLang) {
  const fail = (key: SchemaMessageKey, params?: Record<string, string>) => errors.push(`${path}: ${msg(lang, key, params)}`);
  if (shape === "string") {
    if (typeof value !== "string") fail("expectString");
    return;
  }
  if (shape === "path") {
    if (typeof value !== "string") fail("expectPath");
    else {
      const problem = checkMediaPath(value, lang);
      if (problem) errors.push(`${path}: ${problem}`);
    }
    return;
  }
  if (shape === "href") {
    if (typeof value !== "string") fail("expectHref");
    else {
      const problem = checkHref(value, lang);
      if (problem) errors.push(`${path}: ${problem}`);
    }
    return;
  }
  if (shape === "url") {
    if (typeof value !== "string") fail("expectUrl");
    else {
      const problem = checkSiteUrl(value, lang);
      if (problem) errors.push(`${path}: ${problem}`);
    }
    return;
  }
  if (shape === "anchor") {
    if (typeof value !== "string") fail("expectAnchor");
    else if (!ANCHOR_RE.test(value)) fail("anchorInvalid", { value });
    return;
  }
  if (shape === "icon") {
    if (typeof value !== "string") fail("expectIcon");
    else if (!ICON_SET.has(value)) fail("unknownIcon", { value });
    return;
  }
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) {
      fail("expectList");
      return;
    }
    value.forEach((item, index) => check(item, shape[0], `${path}[${index}]`, errors, lang));
    return;
  }
  if (!isObject(value)) {
    fail("expectObject");
    return;
  }
  for (const [key, inner] of Object.entries(shape)) {
    const innerPath = path ? `${path}.${key}` : key;
    if (!(key in value)) errors.push(`${innerPath}: ${msg(lang, "missingField")}`);
    else check(value[key], inner, innerPath, errors, lang);
  }
}

/** Проверка структуры site.json. Пустой список — всё в порядке. */
export function validateSiteContent(value: unknown, lang: SchemaLang = "ru"): string[] {
  const errors: string[] = [];
  check(value, SITE_SHAPE, "", errors, lang);
  return errors.map((error) => (error.startsWith(":") ? `site${error}` : error));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Проверка gallery.json: список элементов с уникальными id. */
export function validateGallery(value: unknown, lang: SchemaLang = "ru"): string[] {
  if (!Array.isArray(value)) return [`gallery: ${msg(lang, "expectList")}`];
  const errors: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const at = `gallery[${index}]`;
    if (!isObject(item)) {
      errors.push(`${at}: ${msg(lang, "expectObject")}`);
      return;
    }
    for (const key of ["id", "src", "title", "date"]) {
      if (typeof item[key] !== "string") errors.push(`${at}.${key}: ${msg(lang, "expectString")}`);
    }
    if (typeof item.id === "string") {
      if (!item.id) errors.push(`${at}.id: ${msg(lang, "emptyId")}`);
      else if (seen.has(item.id)) errors.push(`${at}.id: ${msg(lang, "duplicateId", { value: item.id })}`);
      seen.add(item.id);
    }
    if (typeof item.src === "string") {
      const problem = checkMediaPath(item.src, lang);
      if (problem) errors.push(`${at}.src: ${problem}`);
    }
    if (item.type !== "image" && item.type !== "video") errors.push(`${at}.type: ${msg(lang, "expectType")}`);
    if ("poster" in item) {
      if (typeof item.poster !== "string") errors.push(`${at}.poster: ${msg(lang, "expectString")}`);
      // Пустой постер допустим: плитка просто покажет первый кадр.
      else if (item.poster) {
        const problem = checkMediaPath(item.poster, lang);
        if (problem) errors.push(`${at}.poster: ${problem}`);
      }
    }
    if (typeof item.date === "string" && !DATE_RE.test(item.date)) errors.push(`${at}.date: ${msg(lang, "expectDate")}`);
  });
  return errors;
}
