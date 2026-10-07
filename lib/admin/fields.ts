// Описание полей редактора: какие блоки есть в site.json, как называются по-русски
// и каким контролом правится каждое поле. Редактор в кабинете строится только по
// этому описанию; тест сверяет его с SITE_SHAPE, чтобы новое поле схемы не пропало
// из кабинета молча. Модуль без зависимостей от React и next — его гоняет node --test.
import { ICON_NAMES, type IconName, type Shape, type SiteContent } from "../content/schema.ts";

type Base = { key: string; label: string; hint?: string };

export type Field =
  | (Base & { kind: "text" })
  | (Base & { kind: "textarea"; rows?: number })
  /** Ссылка (http, mailto, tel, #якорь). */
  | (Base & { kind: "href" })
  /** id секции на странице, без решётки. */
  | (Base & { kind: "anchor" })
  | (Base & { kind: "icon" })
  /** Картинка { src, alt }. alt: "unused" — подпись на сайте не выводится, поле скрыто. */
  | (Base & { kind: "image"; alt?: "edit" | "unused" })
  /** Путь к ролику строкой. */
  | (Base & { kind: "video" })
  | (Base & { kind: "group"; fields: Field[] })
  /** Список: элементы — объекты с полями или просто строки. */
  | (Base & { kind: "list"; itemLabel: string; item: Field[] | "text" | "textarea" });

export type BlockId = keyof SiteContent;
export type Block = { id: BlockId; title: string; description: string; fields: Field[] };

const text = (key: string, label: string, hint?: string): Field => ({ kind: "text", key, label, hint });
const area = (key: string, label: string, hint?: string, rows = 3): Field => ({ kind: "textarea", key, label, hint, rows });
const icon = (key = "icon", label = "Иконка"): Field => ({ kind: "icon", key, label });
const image = (key: string, label: string, hint?: string): Field => ({ kind: "image", key, label, hint });
const kicker = text("kicker", "Надзаголовок", "Маленькая строка над заголовком");

const ICON_TEXT: Field[] = [icon(), text("title", "Заголовок"), area("text", "Текст")];

/** Порядок — как на странице, служебные блоки в конце. */
export const BLOCKS: Block[] = [
  {
    id: "hero",
    title: "Первый экран",
    description: "Большой заголовок, подзаголовок и пункты на первом экране.",
    fields: [
      area("title", "Заголовок", undefined, 2),
      text("subtitle", "Подзаголовок"),
      text("ctaLabel", "Текст кнопки"),
      { kind: "list", key: "bullets", label: "Пункты", itemLabel: "Пункт", item: "text" },
      { kind: "image", key: "image", label: "Фоновая картинка", alt: "unused", hint: "Фон первого экрана. Подпись не нужна: картинка декоративная." },
    ],
  },
  {
    id: "strip",
    title: "Полоса",
    description: "Полоса под первым экраном: приглашение, карточки свойств и факт.",
    fields: [
      {
        kind: "group",
        key: "intro",
        label: "Приглашение",
        fields: [
          area("text", "Текст", undefined, 2),
          text("linkLabel", "Текст ссылки"),
          { kind: "href", key: "linkHref", label: "Куда ведёт ссылка", hint: "#contact — к форме заявки; можно https://… или mailto:…" },
        ],
      },
      { kind: "list", key: "cards", label: "Карточки", itemLabel: "Карточка", item: [icon(), area("text", "Текст", undefined, 2)] },
      { kind: "group", key: "fact", label: "Факт", fields: [text("value", "Число"), area("text", "Пояснение", undefined, 2)] },
    ],
  },
  {
    id: "product",
    title: "Продукты",
    description: "Блок «Our solutions» с карточками двух продуктовых линеек.",
    fields: [
      kicker,
      text("title", "Заголовок"),
      area("lead", "Вводный текст", undefined, 2),
      text("featuresLabel", "Подпись над списком свойств"),
      {
        kind: "list",
        key: "solutions",
        label: "Решения",
        itemLabel: "Решение",
        item: [
          icon(),
          text("kicker", "Надзаголовок"),
          area("title", "Заголовок", "Перенос строки (Enter) — место переноса в заголовке карточки", 2),
          area("lead", "Описание"),
          { kind: "list", key: "features", label: "Свойства", itemLabel: "Свойство", item: "text" },
          image("image", "Картинка"),
        ],
      },
    ],
  },
  {
    id: "fuscum",
    title: "Sphagnum Fuscum",
    description: "Сырьевая база: площадь болот и большая фотография.",
    fields: [
      kicker,
      text("areaValue", "Площадь, число"),
      text("areaUnit", "Единица"),
      text("areaCaption", "Подпись к площади"),
      image("image", "Фотография"),
    ],
  },
  {
    id: "wetland",
    title: "Васюганские болота",
    description: "Текст о болотах, факты о заготовке и фото живой стены.",
    fields: [
      area("text", "Текст", undefined, 4),
      { kind: "list", key: "facts", label: "Факты", itemLabel: "Факт", item: [icon(), text("value", "Значение"), area("text", "Пояснение", undefined, 2)] },
      image("wallImage", "Фото живой стены"),
    ],
  },
  {
    id: "platform",
    title: "Субстраты",
    description: "Платформа субстратов: опоры, преимущества, линейка продуктов.",
    fields: [
      kicker,
      text("title", "Заголовок"),
      area("lead", "Вводный текст", undefined, 2),
      { kind: "list", key: "pillars", label: "Опоры", itemLabel: "Опора", item: ICON_TEXT },
      image("rootZoneImage", "Картинка корневой зоны"),
      text("benefitsTitle", "Заголовок преимуществ"),
      { kind: "list", key: "benefits", label: "Преимущества", itemLabel: "Преимущество", item: ICON_TEXT },
      text("rangeTitle", "Заголовок линейки"),
      { kind: "list", key: "range", label: "Линейка", itemLabel: "Продукт", item: [icon(), text("name", "Название"), area("text", "Описание", undefined, 2)] },
      text("ctaLabel", "Текст кнопки"),
    ],
  },
  {
    id: "gallery",
    title: "Галерея",
    description: "Заголовок и подписи галереи. Фото и ролики — ниже, в «Элементах галереи».",
    fields: [
      kicker,
      text("title", "Заголовок"),
      text("titleAccent", "Заголовок, золотая часть", "Выводится после заголовка через пробел"),
      text("username", "Имя аккаунта Instagram"),
      { kind: "href", key: "profileUrl", label: "Ссылка на профиль" },
      text("followLabel", "Кнопка «подписаться»"),
      text("showMoreLabel", "Кнопка «показать ещё»"),
      text("showLessLabel", "Кнопка «свернуть»"),
      text("openLabel", "Подсказка «открыть»"),
      text("viewOnInstagramLabel", "Ссылка «смотреть в Instagram»"),
      text("closeLabel", "Кнопка «закрыть»"),
      text("previousLabel", "Кнопка «предыдущее фото»"),
      text("nextLabel", "Кнопка «следующее фото»"),
    ],
  },
  {
    id: "applications",
    title: "Применение",
    description: "Где работают решения: карточки с фото и списком выгод.",
    fields: [
      kicker,
      text("title", "Заголовок"),
      text("itemKicker", "Надзаголовок карточек"),
      {
        kind: "list",
        key: "items",
        label: "Карточки",
        itemLabel: "Карточка",
        item: [
          text("title", "Заголовок"),
          area("text", "Текст"),
          image("image", "Картинка"),
          {
            kind: "list",
            key: "benefits",
            label: "Выгоды",
            itemLabel: "Выгода",
            item: [icon(), text("title", "Заголовок"), area("text", "Текст", "Можно оставить пустым — тогда только заголовок", 2)],
          },
        ],
      },
    ],
  },
  {
    id: "advantages",
    title: "Преимущества",
    description: "Почему мы: карточки преимуществ и ярлыки.",
    fields: [
      kicker,
      text("title", "Заголовок"),
      text("titleAccent", "Заголовок, золотая часть"),
      area("lead", "Вводный текст"),
      { kind: "list", key: "items", label: "Преимущества", itemLabel: "Преимущество", item: ICON_TEXT },
      { kind: "list", key: "tags", label: "Ярлыки", itemLabel: "Ярлык", item: [icon(), text("label", "Текст")] },
    ],
  },
  {
    id: "faq",
    title: "FAQ",
    description: "Частые вопросы и ответы.",
    fields: [
      kicker,
      text("title", "Заголовок"),
      { kind: "list", key: "items", label: "Вопросы", itemLabel: "Вопрос", item: [text("question", "Вопрос"), area("answer", "Ответ", undefined, 4)] },
    ],
  },
  {
    id: "contact",
    title: "Заявка",
    description: "Блок с формой заявки внизу страницы.",
    fields: [
      kicker,
      text("title", "Заголовок"),
      area("lead", "Вводный текст"),
      { kind: "list", key: "deliverables", label: "Что получит клиент", itemLabel: "Пункт", item: [text("title", "Заголовок"), area("text", "Текст", undefined, 2)] },
      text("formTitle", "Заголовок формы"),
      text("formLead", "Текст под заголовком формы"),
      area("consent", "Согласие на обработку данных"),
      {
        kind: "group",
        key: "form",
        label: "Поля формы",
        fields: [
          text("ariaLabel", "Название формы для экранных читалок"),
          text("nameLabel", "Поле «имя»"),
          text("emailLabel", "Поле «email»"),
          text("phoneLabel", "Поле «телефон»"),
          text("regionLabel", "Поле «регион»"),
          text("projectTypeLabel", "Поле «тип проекта»"),
          text("projectTypePlaceholder", "Подсказка в списке типов"),
          { kind: "list", key: "projectTypes", label: "Типы проектов", itemLabel: "Тип", item: "text" },
          text("areaLabel", "Поле «площадь»"),
          text("messageLabel", "Поле «сообщение»"),
          text("messageHint", "Пометка к сообщению"),
          text("submitLabel", "Кнопка отправки"),
          text("successMessage", "Сообщение после отправки"),
        ],
      },
    ],
  },
  {
    id: "contacts",
    title: "Контакты",
    description: "Контактное лицо, телефон и почта.",
    fields: [
      text("person", "Имя"),
      text("role", "Должность"),
      text("phone", "Телефон", "Ссылка tel: подставится сама"),
      text("email", "Электронная почта", "Ссылка mailto: подставится сама"),
    ],
  },
  {
    id: "nav",
    title: "Меню",
    description: "Пункты верхнего меню и кнопка в шапке.",
    fields: [
      {
        kind: "list",
        key: "links",
        label: "Пункты меню",
        itemLabel: "Пункт",
        item: [text("label", "Название"), { kind: "anchor", key: "target", label: "Раздел страницы" }],
      },
      text("ctaLabel", "Кнопка в шапке"),
      text("openMenuLabel", "Подпись «открыть меню»", "Для экранных читалок"),
      text("closeMenuLabel", "Подпись «закрыть меню»", "Для экранных читалок"),
    ],
  },
  {
    id: "footer",
    title: "Подвал",
    description: "Строка внизу страницы.",
    fields: [text("copyright", "Копирайт")],
  },
  {
    id: "loader",
    title: "Экран загрузки",
    description: "Фразы, которые сменяются, пока грузится страница.",
    fields: [
      text("label", "Подпись для экранных читалок"),
      text("srLabel", "Скрытая подпись"),
      { kind: "list", key: "phrases", label: "Фразы", itemLabel: "Фраза", item: "text" },
    ],
  },
  {
    id: "meta",
    title: "SEO",
    description: "Заголовок вкладки и описания для поисковиков и соцсетей.",
    fields: [
      text("title", "Заголовок вкладки"),
      area("description", "Описание для поисковиков"),
      area("shareDescription", "Описание при пересылке ссылки", undefined, 2),
    ],
  },
];

/** id секций лендинга — для подсказки в поле «Раздел страницы». */
export const SECTION_ANCHORS: { id: string; label: string }[] = [
  { id: "top", label: "Первый экран" },
  { id: "product", label: "Продукты" },
  { id: "applications", label: "Применение" },
  { id: "fuscum", label: "Sphagnum Fuscum" },
  { id: "projects", label: "Галерея" },
  { id: "advantages", label: "Преимущества" },
  { id: "faq", label: "FAQ" },
  { id: "contact", label: "Заявка" },
];

/** Подписи иконок в выборе. */
export const ICON_LABELS: Record<IconName, string> = {
  droplet: "Капли",
  wind: "Ветер",
  sprout: "Росток",
  sun: "Солнце",
  weight: "Гиря",
  moss: "Лист",
  roof: "Здание",
  battery: "Батарея",
  shield: "Щит",
  recycle: "Переработка",
  layers: "Слои",
  porosity: "Сетка",
  stable: "Линейка",
  temperature: "Термометр",
  factory: "Завод",
  flask: "Колба",
  headset: "Наушники",
  circleOff: "Запрет",
  flower: "Цветок",
  globe: "Глобус",
  hand: "Рука с сердцем",
  layers3: "Три слоя",
  refresh: "Обновление",
  shovel: "Лопата",
  star: "Звезда",
  thermometerSun: "Жара",
  waves: "Волны",
};

/* ---------- листья: для сверки описания со схемой ---------- */

export type LeafKind = "string" | "path" | "icon" | "href" | "anchor";

/** Листья описания полей в виде "hero.image.src:path", элементы списков — "[]". */
export function fieldLeaves(fields: Field[], prefix = ""): string[] {
  return fields.flatMap((field) => {
    const at = prefix ? `${prefix}.${field.key}` : field.key;
    switch (field.kind) {
      case "text":
      case "textarea":
        return [`${at}:string`];
      case "href":
      case "anchor":
      case "icon":
        return [`${at}:${field.kind}`];
      case "video":
        return [`${at}:path`];
      case "image":
        return [`${at}.src:path`, `${at}.alt:string`];
      case "group":
        return fieldLeaves(field.fields, at);
      case "list":
        return typeof field.item === "string" ? [`${at}[]:string`] : fieldLeaves(field.item, `${at}[]`);
    }
  });
}

/** Те же листья, но из SITE_SHAPE. */
export function shapeLeaves(shape: Shape, prefix = ""): string[] {
  if (typeof shape === "string") return [`${prefix}:${shape}`];
  if (Array.isArray(shape)) return shapeLeaves(shape[0], `${prefix}[]`);
  return Object.entries(shape).flatMap(([key, inner]) => shapeLeaves(inner, prefix ? `${prefix}.${key}` : key));
}

export function blockLeaves(blocks: Block[] = BLOCKS): string[] {
  return blocks.flatMap((block) => fieldLeaves(block.fields, block.id));
}

/* ---------- новые элементы списков ---------- */

export function emptyValue(field: Field): unknown {
  switch (field.kind) {
    case "icon":
      return "moss" satisfies IconName;
    case "image":
      return { src: "", alt: "" };
    case "group":
      return emptyObject(field.fields);
    case "list":
      return [];
    default:
      return "";
  }
}

export function emptyObject(fields: Field[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [field.key, emptyValue(field)]));
}

export function newListItem(field: Extract<Field, { kind: "list" }>): unknown {
  return typeof field.item === "string" ? "" : emptyObject(field.item);
}

/* ---------- ошибки API → поля ---------- */

export type FieldError = { file: "site" | "gallery"; path: string; message: string };

/* API отдаёт ошибки строками "<путь>: <текст>". Путь site.json без префикса
   ("hero.title"), gallery.json — с "gallery[<n>]". Блок site.json тоже зовётся
   gallery, но у него после имени идёт точка, а не скобка. */
export function parseApiError(line: string): FieldError {
  const at = line.indexOf(": ");
  const path = at > 0 ? line.slice(0, at) : "";
  const message = at > 0 ? line.slice(at + 2) : line;
  if (path === "gallery" || path.startsWith("gallery[")) return { file: "gallery", path, message };
  return { file: "site", path: path === "site" ? "" : path, message };
}

/** "product.solutions[0].image.src" → ["product", "solutions", 0, "image", "src"]. */
export function splitPath(path: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  for (const match of path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) {
    tokens.push(match[2] !== undefined ? Number(match[2]) : match[1]);
  }
  return tokens;
}

const IMAGE_PARTS: Record<string, string> = { src: "файл", alt: "подпись" };

/** Человеческое название места: "Продукты › Решения № 1 › Картинка › файл". */
export function describePath(file: "site" | "gallery", path: string): { blockId: BlockId | null; label: string } {
  const tokens = splitPath(path);
  if (file === "gallery") {
    const [, index, key] = tokens;
    const parts = ["Галерея"];
    if (typeof index === "number") parts.push(`Элемент № ${index + 1}`);
    const names: Record<string, string> = { src: "файл", poster: "постер", title: "подпись", date: "дата", id: "id", type: "тип" };
    if (typeof key === "string") parts.push(names[key] ?? key);
    return { blockId: "gallery", label: parts.join(" › ") };
  }

  const block = BLOCKS.find((candidate) => candidate.id === tokens[0]);
  if (!block) return { blockId: null, label: path || "Контент сайта" };
  const parts = [block.title];
  let fields: Field[] | null = block.fields;
  let i = 1;
  while (i < tokens.length && fields) {
    const field: Field | undefined = fields.find((candidate) => candidate.key === tokens[i]);
    if (!field) {
      parts.push(String(tokens[i]));
      break;
    }
    parts.push(field.label);
    i += 1;
    if (field.kind === "group") fields = field.fields;
    else if (field.kind === "list") {
      if (typeof tokens[i] === "number") {
        parts.push(`${field.itemLabel} № ${(tokens[i] as number) + 1}`);
        i += 1;
      }
      fields = typeof field.item === "string" ? null : field.item;
    } else if (field.kind === "image") {
      if (typeof tokens[i] === "string") parts.push(IMAGE_PARTS[tokens[i] as string] ?? String(tokens[i]));
      fields = null;
    } else fields = null;
  }
  return { blockId: block.id, label: parts.join(" › ") };
}

/** usedIn из DELETE /api/admin/media: "site: hero.image.src", "gallery: [3].poster". */
export function describeUsage(entry: string): string {
  const at = entry.indexOf(": ");
  const name = entry.slice(0, at);
  const path = entry.slice(at + 2);
  return name === "gallery" ? describePath("gallery", `gallery${path}`).label : describePath("site", path).label;
}

export { ICON_NAMES };
