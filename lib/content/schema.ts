// Типы контента сайта и структурная проверка JSON из content/.
// Модуль без зависимостей и без алиаса @/: его гоняет `node --test` напрямую.

/** Ключи иконок, которые умеет рисовать лендинг (карта ICONS в sphagnum-landing). */
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
  meta: { title: string; description: string; shareDescription: string };
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
   вылезет сразу. */
type Shape = "string" | "path" | "icon" | Shape[] | { [key: string]: Shape };

const IMAGE: Shape = { src: "path", alt: "string" };
const ICON_TEXT: Shape = { icon: "icon", title: "string", text: "string" };

const SITE_SHAPE: Shape = {
  meta: { title: "string", description: "string", shareDescription: "string" },
  contacts: { person: "string", role: "string", phone: "string", email: "string" },
  nav: {
    links: [{ label: "string", target: "string" }],
    ctaLabel: "string",
    openMenuLabel: "string",
    closeMenuLabel: "string",
  },
  hero: { title: "string", subtitle: "string", ctaLabel: "string", bullets: ["string"], image: IMAGE },
  strip: {
    intro: { text: "string", linkLabel: "string", linkHref: "string" },
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
    profileUrl: "string",
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function check(value: unknown, shape: Shape, path: string, errors: string[]) {
  if (shape === "string") {
    if (typeof value !== "string") errors.push(`${path}: ожидается строка`);
    return;
  }
  if (shape === "path") {
    if (typeof value !== "string") errors.push(`${path}: ожидается путь к файлу`);
    else if (!value.trim()) errors.push(`${path}: пустой путь`);
    return;
  }
  if (shape === "icon") {
    if (typeof value !== "string") errors.push(`${path}: ожидается ключ иконки`);
    else if (!ICON_SET.has(value)) errors.push(`${path}: неизвестная иконка «${value}»`);
    return;
  }
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) {
      errors.push(`${path}: ожидается список`);
      return;
    }
    value.forEach((item, index) => check(item, shape[0], `${path}[${index}]`, errors));
    return;
  }
  if (!isObject(value)) {
    errors.push(`${path}: ожидается объект`);
    return;
  }
  for (const [key, inner] of Object.entries(shape)) {
    const innerPath = path ? `${path}.${key}` : key;
    if (!(key in value)) errors.push(`${innerPath}: нет обязательного поля`);
    else check(value[key], inner, innerPath, errors);
  }
}

/** Проверка структуры site.json. Пустой список — всё в порядке. */
export function validateSiteContent(value: unknown): string[] {
  const errors: string[] = [];
  check(value, SITE_SHAPE, "", errors);
  return errors.map((error) => (error.startsWith(":") ? `site${error}` : error));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Проверка gallery.json: список элементов с уникальными id. */
export function validateGallery(value: unknown): string[] {
  if (!Array.isArray(value)) return ["gallery: ожидается список"];
  const errors: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const at = `gallery[${index}]`;
    if (!isObject(item)) {
      errors.push(`${at}: ожидается объект`);
      return;
    }
    for (const key of ["id", "src", "title", "date"]) {
      if (typeof item[key] !== "string") errors.push(`${at}.${key}: ожидается строка`);
    }
    if (typeof item.id === "string") {
      if (!item.id) errors.push(`${at}.id: пустой id`);
      else if (seen.has(item.id)) errors.push(`${at}.id: повторяется «${item.id}»`);
      seen.add(item.id);
    }
    if (typeof item.src === "string" && !item.src) errors.push(`${at}.src: пустой путь`);
    if (item.type !== "image" && item.type !== "video") errors.push(`${at}.type: ожидается "image" или "video"`);
    if ("poster" in item && typeof item.poster !== "string") errors.push(`${at}.poster: ожидается строка`);
    if (typeof item.date === "string" && !DATE_RE.test(item.date)) errors.push(`${at}.date: ожидается дата YYYY-MM-DD`);
  });
  return errors;
}
