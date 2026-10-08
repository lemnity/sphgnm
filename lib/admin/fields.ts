// Описание полей редактора: какие блоки есть в site.json, как называются (по-русски и по-английски)
// и каким контролом правится каждое поле. Редактор в кабинете строится только по
// этому описанию; тест сверяет его с SITE_SHAPE, чтобы новое поле схемы не пропало
// из кабинета молча. Модуль без зависимостей от React и next — его гоняет node --test.
import { ICON_NAMES, type IconName, type Shape, type SiteContent } from "../content/schema.ts";
import { translate, type AdminLang } from "./i18n.ts";

/** Подпись на двух языках кабинета. */
export type L = { ru: string; en: string };
const l = (ru: string, en: string): L => ({ ru, en });

type Base = { key: string; label: L; hint?: L };

export type Field =
  | (Base & { kind: "text" })
  | (Base & { kind: "textarea"; rows?: number })
  /** Ссылка (http, mailto, tel, #якорь). */
  | (Base & { kind: "href" })
  /** Полный адрес сайта (https://…). */
  | (Base & { kind: "url" })
  /** id секции на странице, без решётки. */
  | (Base & { kind: "anchor" })
  | (Base & { kind: "icon" })
  /** Картинка { src, alt }. alt: "unused" — подпись на сайте не выводится, поле скрыто. */
  | (Base & { kind: "image"; alt?: "edit" | "unused" })
  /** Путь к ролику строкой. */
  | (Base & { kind: "video" })
  | (Base & { kind: "group"; fields: Field[] })
  /** Список: элементы — объекты с полями или просто строки. */
  | (Base & { kind: "list"; itemLabel: L; item: Field[] | "text" | "textarea" });

export type BlockId = keyof SiteContent;
export type Block = { id: BlockId; title: L; description: L; fields: Field[] };

const text = (key: string, label: L, hint?: L): Field => ({ kind: "text", key, label, hint });
const area = (key: string, label: L, hint?: L, rows = 3): Field => ({ kind: "textarea", key, label, hint, rows });
const image = (key: string, label: L, hint?: L): Field => ({ kind: "image", key, label, hint });
const list = (key: string, label: L, itemLabel: L, item: Field[] | "text" | "textarea", hint?: L): Field => ({ kind: "list", key, label, itemLabel, item, hint });

/* Частые подписи. */
const T = {
  icon: l("Иконка", "Icon"),
  title: l("Заголовок", "Heading"),
  text: l("Текст", "Text"),
  lead: l("Вводный текст", "Intro text"),
  description: l("Описание", "Description"),
  explanation: l("Пояснение", "Explanation"),
  picture: l("Картинка", "Image"),
  card: l("Карточка", "Card"),
  cards: l("Карточки", "Cards"),
  item: l("Пункт", "Item"),
  advantage: l("Преимущество", "Advantage"),
  advantages: l("Преимущества", "Advantages"),
  buttonText: l("Текст кнопки", "Button text"),
  accent: l("Заголовок, золотая часть", "Heading, gold part"),
  srOnly: l("Для экранных читалок", "For screen readers"),
};

const icon = (key = "icon", label = T.icon): Field => ({ kind: "icon", key, label });
const kicker = text("kicker", l("Надзаголовок", "Eyebrow"), l("Маленькая строка над заголовком", "Small line above the heading"));

const ICON_TEXT: Field[] = [icon(), text("title", T.title), area("text", T.text)];

/** Порядок — как на странице, служебные блоки в конце. */
export const BLOCKS: Block[] = [
  {
    id: "hero",
    title: l("Первый экран", "Hero"),
    description: l("Большой заголовок, подзаголовок и пункты на первом экране.", "The big headline, subheading and bullet points at the top of the page."),
    fields: [
      area("title", T.title, undefined, 2),
      text("subtitle", l("Подзаголовок", "Subheading")),
      text("ctaLabel", T.buttonText),
      list("bullets", l("Пункты", "Bullet points"), l("Пункт", "Bullet"), "text"),
      {
        kind: "image",
        key: "image",
        label: l("Фоновая картинка", "Background image"),
        alt: "unused",
        hint: l("Фон первого экрана. Подпись не нужна: картинка декоративная.", "Background of the hero section. No description needed: the image is decorative."),
      },
    ],
  },
  {
    id: "strip",
    title: l("Полоса", "Highlights strip"),
    description: l("Полоса под первым экраном: приглашение, карточки свойств и факт.", "The strip below the hero: an invitation, feature cards and a key fact."),
    fields: [
      {
        kind: "group",
        key: "intro",
        label: l("Приглашение", "Invitation"),
        fields: [
          area("text", T.text, undefined, 2),
          text("linkLabel", l("Текст ссылки", "Link text")),
          {
            kind: "href",
            key: "linkHref",
            label: l("Куда ведёт ссылка", "Link target"),
            hint: l("#contact — к форме заявки; можно https://… или mailto:…", "#contact goes to the enquiry form; https://… or mailto:… also work"),
          },
        ],
      },
      list("cards", T.cards, T.card, [icon(), area("text", T.text, undefined, 2)]),
      { kind: "group", key: "fact", label: l("Факт", "Key fact"), fields: [text("value", l("Число", "Number")), area("text", T.explanation, undefined, 2)] },
    ],
  },
  {
    id: "product",
    title: l("Продукты", "Products"),
    description: l("Блок «Our solutions» с карточками двух продуктовых линеек.", "The “Our solutions” section with cards for the two product lines."),
    fields: [
      kicker,
      text("title", T.title),
      area("lead", T.lead, undefined, 2),
      text("featuresLabel", l("Подпись над списком свойств", "Label above the feature list")),
      list("solutions", l("Решения", "Solutions"), l("Решение", "Solution"), [
        icon(),
        text("kicker", l("Надзаголовок", "Eyebrow")),
        area("title", T.title, l("Перенос строки (Enter) — место переноса в заголовке карточки", "A line break (Enter) marks where the card heading wraps"), 2),
        area("lead", T.description),
        list("features", l("Свойства", "Features"), l("Свойство", "Feature"), "text"),
        image("image", T.picture),
      ]),
    ],
  },
  {
    id: "fuscum",
    title: l("Sphagnum Fuscum", "Sphagnum Fuscum"),
    description: l("Сырьевая база: площадь болот и большая фотография.", "The raw-material source: wetland area and a large photo."),
    fields: [
      kicker,
      text("areaValue", l("Площадь, число", "Area, number")),
      text("areaUnit", l("Единица", "Unit")),
      text("areaCaption", l("Подпись к площади", "Area caption")),
      image("image", l("Фотография", "Photo")),
    ],
  },
  {
    id: "wetland",
    title: l("Васюганские болота", "Vasyugan Mire"),
    description: l("Текст о болотах, факты о заготовке и фото живой стены.", "Text about the mire, harvesting facts and a photo of the living wall."),
    fields: [
      area("text", T.text, undefined, 4),
      list("facts", l("Факты", "Facts"), l("Факт", "Fact"), [icon(), text("value", l("Значение", "Value")), area("text", T.explanation, undefined, 2)]),
      image("wallImage", l("Фото живой стены", "Living wall photo")),
    ],
  },
  {
    id: "platform",
    title: l("Субстраты", "Substrates"),
    description: l("Платформа субстратов: опоры, преимущества, линейка продуктов.", "The substrate platform: pillars, benefits and the product range."),
    fields: [
      kicker,
      text("title", T.title),
      area("lead", T.lead, undefined, 2),
      list("pillars", l("Опоры", "Pillars"), l("Опора", "Pillar"), ICON_TEXT),
      image("rootZoneImage", l("Картинка корневой зоны", "Root zone image")),
      text("benefitsTitle", l("Заголовок преимуществ", "Benefits heading")),
      list("benefits", T.advantages, T.advantage, ICON_TEXT),
      text("rangeTitle", l("Заголовок линейки", "Product range heading")),
      list("range", l("Линейка", "Product range"), l("Продукт", "Product"), [icon(), text("name", l("Название", "Name")), area("text", T.description, undefined, 2)]),
      text("ctaLabel", T.buttonText),
    ],
  },
  {
    id: "gallery",
    title: l("Галерея", "Gallery"),
    description: l(
      "Заголовок и подписи галереи. Фото и ролики — ниже, в «Элементах галереи».",
      "Gallery heading and labels. Photos and videos are below, under “Gallery items”.",
    ),
    fields: [
      kicker,
      text("title", T.title),
      text("titleAccent", T.accent, l("Выводится после заголовка через пробел", "Shown right after the heading, separated by a space")),
      text("username", l("Имя аккаунта Instagram", "Instagram username")),
      { kind: "href", key: "profileUrl", label: l("Ссылка на профиль", "Profile link") },
      text("followLabel", l("Кнопка «подписаться»", "“Follow” button")),
      text("showMoreLabel", l("Кнопка «показать ещё»", "“Show more” button")),
      text("showLessLabel", l("Кнопка «свернуть»", "“Show less” button")),
      text("openLabel", l("Подсказка «открыть»", "“Open” hint")),
      text("viewOnInstagramLabel", l("Ссылка «смотреть в Instagram»", "“View on Instagram” link")),
      text("closeLabel", l("Кнопка «закрыть»", "“Close” button")),
      text("previousLabel", l("Кнопка «предыдущее фото»", "“Previous photo” button")),
      text("nextLabel", l("Кнопка «следующее фото»", "“Next photo” button")),
    ],
  },
  {
    id: "applications",
    title: l("Применение", "Applications"),
    description: l("Где работают решения: карточки с фото и списком выгод.", "Where the solutions are used: cards with a photo and a list of benefits."),
    fields: [
      kicker,
      text("title", T.title),
      text("itemKicker", l("Надзаголовок карточек", "Card eyebrow")),
      list("items", T.cards, T.card, [
        text("title", T.title),
        area("text", T.text),
        image("image", T.picture),
        list("benefits", l("Выгоды", "Benefits"), l("Выгода", "Benefit"), [
          icon(),
          text("title", T.title),
          area("text", T.text, l("Можно оставить пустым — тогда только заголовок", "Can be left empty — then only the heading is shown"), 2),
        ]),
      ]),
    ],
  },
  {
    id: "advantages",
    title: T.advantages,
    description: l("Почему мы: карточки преимуществ и ярлыки.", "Why us: advantage cards and tags."),
    fields: [
      kicker,
      text("title", T.title),
      text("titleAccent", T.accent),
      area("lead", T.lead),
      list("items", T.advantages, T.advantage, ICON_TEXT),
      list("tags", l("Ярлыки", "Tags"), l("Ярлык", "Tag"), [icon(), text("label", T.text)]),
    ],
  },
  {
    id: "faq",
    title: l("FAQ", "FAQ"),
    description: l("Частые вопросы и ответы.", "Frequently asked questions and answers."),
    fields: [
      kicker,
      text("title", T.title),
      list("items", l("Вопросы", "Questions"), l("Вопрос", "Question"), [text("question", l("Вопрос", "Question")), area("answer", l("Ответ", "Answer"), undefined, 4)]),
    ],
  },
  {
    id: "contact",
    title: l("Заявка", "Enquiry"),
    description: l("Блок с формой заявки внизу страницы.", "The enquiry form section at the bottom of the page."),
    fields: [
      kicker,
      text("title", T.title),
      area("lead", T.lead),
      list("deliverables", l("Что получит клиент", "What the client gets"), T.item, [text("title", T.title), area("text", T.text, undefined, 2)]),
      text("formTitle", l("Заголовок формы", "Form heading")),
      text("formLead", l("Текст под заголовком формы", "Text below the form heading")),
      area("consent", l("Согласие на обработку данных", "Data processing consent")),
      {
        kind: "group",
        key: "form",
        label: l("Поля формы", "Form fields"),
        fields: [
          text("ariaLabel", l("Название формы для экранных читалок", "Form name for screen readers")),
          text("nameLabel", l("Поле «имя»", "“Name” field")),
          text("emailLabel", l("Поле «email»", "“Email” field")),
          text("phoneLabel", l("Поле «телефон»", "“Phone” field")),
          text("regionLabel", l("Поле «регион»", "“Region” field")),
          text("projectTypeLabel", l("Поле «тип проекта»", "“Project type” field")),
          text("projectTypePlaceholder", l("Подсказка в списке типов", "Project type placeholder")),
          list("projectTypes", l("Типы проектов", "Project types"), l("Тип", "Type"), "text"),
          text("areaLabel", l("Поле «площадь»", "“Area” field")),
          text("messageLabel", l("Поле «сообщение»", "“Message” field")),
          text("messageHint", l("Пометка к сообщению", "Note next to the message field")),
          text("submitLabel", l("Кнопка отправки", "Submit button")),
          text("successMessage", l("Сообщение после отправки", "Message after sending")),
        ],
      },
    ],
  },
  {
    id: "contacts",
    title: l("Контакты", "Contacts"),
    description: l(
      "Контактное лицо, телефон и почта. Пустые поля на сайте не показываются: заполните — и они появятся.",
      "Contact person, phone number and email. Empty fields are hidden on the site — fill them in and they appear.",
    ),
    fields: [
      text("person", l("Имя", "Name"), l("Пусто — блок с контактным лицом скрыт", "Leave empty to hide the contact person")),
      text("role", l("Должность", "Job title"), l("Показывается под именем", "Shown under the name")),
      text("phone", l("Телефон", "Phone"), l("Пусто — телефона нет на сайте; ссылка tel: подставится сама", "Leave empty to hide the phone; the tel: link is added automatically")),
      text("email", l("Электронная почта", "Email"), l("Ссылка mailto: подставится сама", "The mailto: link is added automatically")),
    ],
  },
  {
    id: "nav",
    title: l("Меню", "Menu"),
    description: l("Пункты верхнего меню и кнопка в шапке.", "Top menu items and the header button."),
    fields: [
      list("links", l("Пункты меню", "Menu items"), T.item, [text("label", l("Название", "Label")), { kind: "anchor", key: "target", label: l("Раздел страницы", "Page section") }]),
      text("ctaLabel", l("Кнопка в шапке", "Header button")),
      text("openMenuLabel", l("Подпись «открыть меню»", "“Open menu” label"), T.srOnly),
      text("closeMenuLabel", l("Подпись «закрыть меню»", "“Close menu” label"), T.srOnly),
    ],
  },
  {
    id: "footer",
    title: l("Подвал", "Footer"),
    description: l("Строка внизу страницы.", "The line at the very bottom of the page."),
    fields: [text("copyright", l("Копирайт", "Copyright"))],
  },
  {
    id: "loader",
    title: l("Экран загрузки", "Loading screen"),
    description: l("Фразы, которые сменяются, пока грузится страница.", "Phrases that rotate while the page is loading."),
    fields: [
      text("label", l("Подпись для экранных читалок", "Label for screen readers")),
      text("srLabel", l("Скрытая подпись", "Hidden label")),
      list("phrases", l("Фразы", "Phrases"), l("Фраза", "Phrase"), "text"),
    ],
  },
  {
    id: "meta",
    title: l("SEO", "SEO"),
    description: l(
      "Заголовок вкладки, описания для поисковиков и превью ссылки в соцсетях и мессенджерах.",
      "Browser tab title, search engine descriptions and the link preview in social networks and messengers.",
    ),
    fields: [
      text("title", l("Заголовок вкладки", "Browser tab title")),
      area("description", l("Описание для поисковиков", "Search engine description")),
      area("shareDescription", l("Описание при пересылке ссылки", "Link preview description"), undefined, 2),
      image(
        "image",
        l("Картинка-превью ссылки", "Link preview image"),
        l(
          "Показывается, когда ссылкой делятся в соцсетях и мессенджерах. Лучше 1200×630, JPG или PNG (WebP видят не все сети), до 5 МБ.",
          "Shown when the link is shared on social networks and messengers. Best at 1200×630, JPG or PNG (not every network shows WebP), under 5 MB.",
        ),
      ),
      {
        kind: "url",
        key: "siteUrl",
        label: l("Адрес сайта", "Site address"),
        hint: l(
          "Полный публичный адрес вместе с подпапкой, если она есть: https://lemnity.github.io/sphgnm. От него строятся ссылки на превью. После переезда на свой домен поменяйте его.",
          "The full public address, including the subfolder if there is one: https://lemnity.github.io/sphgnm. Preview links are built from it. Change it after moving to your own domain.",
        ),
      },
    ],
  },
];

/** id секций лендинга — для подсказки в поле «Раздел страницы». */
export const SECTION_ANCHORS: { id: string; label: L }[] = [
  { id: "top", label: l("Первый экран", "Hero") },
  { id: "product", label: l("Продукты", "Products") },
  { id: "applications", label: l("Применение", "Applications") },
  { id: "fuscum", label: l("Sphagnum Fuscum", "Sphagnum Fuscum") },
  { id: "projects", label: l("Галерея", "Gallery") },
  { id: "advantages", label: T.advantages },
  { id: "faq", label: l("FAQ", "FAQ") },
  { id: "contact", label: l("Заявка", "Enquiry") },
];

/** Подписи иконок в выборе. */
export const ICON_LABELS: Record<IconName, L> = {
  droplet: l("Капли", "Droplets"),
  wind: l("Ветер", "Wind"),
  sprout: l("Росток", "Sprout"),
  sun: l("Солнце", "Sun"),
  weight: l("Гиря", "Weight"),
  moss: l("Лист", "Leaf"),
  roof: l("Здание", "Building"),
  battery: l("Батарея", "Battery"),
  shield: l("Щит", "Shield"),
  recycle: l("Переработка", "Recycling"),
  layers: l("Слои", "Layers"),
  porosity: l("Сетка", "Grid"),
  stable: l("Линейка", "Ruler"),
  temperature: l("Термометр", "Thermometer"),
  factory: l("Завод", "Factory"),
  flask: l("Колба", "Flask"),
  headset: l("Наушники", "Headset"),
  circleOff: l("Запрет", "Prohibited"),
  flower: l("Цветок", "Flower"),
  globe: l("Глобус", "Globe"),
  hand: l("Рука с сердцем", "Hand with heart"),
  layers3: l("Три слоя", "Three layers"),
  refresh: l("Обновление", "Refresh"),
  shovel: l("Лопата", "Shovel"),
  star: l("Звезда", "Star"),
  thermometerSun: l("Жара", "Heat"),
  waves: l("Волны", "Waves"),
};

/* ---------- листья: для сверки описания со схемой ---------- */

export type LeafKind = "string" | "path" | "icon" | "href" | "anchor" | "url";

/** Листья описания полей в виде "hero.image.src:path", элементы списков — "[]". */
export function fieldLeaves(fields: Field[], prefix = ""): string[] {
  return fields.flatMap((field) => {
    const at = prefix ? `${prefix}.${field.key}` : field.key;
    switch (field.kind) {
      case "text":
      case "textarea":
        return [`${at}:string`];
      case "href":
      case "url":
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

const IMAGE_PARTS: Record<string, L> = { src: l("файл", "file"), alt: l("подпись", "alt text") };
const GALLERY_PARTS: Record<string, L> = {
  src: l("файл", "file"),
  poster: l("постер", "poster"),
  title: l("подпись", "caption"),
  date: l("дата", "date"),
  id: l("id", "id"),
  type: l("тип", "type"),
};

/** Человеческое название места: "Продукты › Решения › Решение № 1 › Картинка › файл". */
export function describePath(file: "site" | "gallery", path: string, lang: AdminLang = "ru"): { blockId: BlockId | null; label: string } {
  const tokens = splitPath(path);
  if (file === "gallery") {
    const [, index, key] = tokens;
    const parts = [BLOCKS.find((block) => block.id === "gallery")!.title[lang]];
    if (typeof index === "number") parts.push(translate(lang, "gallery.item", { n: index + 1 }));
    if (typeof key === "string") parts.push(GALLERY_PARTS[key]?.[lang] ?? key);
    return { blockId: "gallery", label: parts.join(" › ") };
  }

  const block = BLOCKS.find((candidate) => candidate.id === tokens[0]);
  if (!block) return { blockId: null, label: path || (lang === "en" ? "Site content" : "Контент сайта") };
  const parts = [block.title[lang]];
  let fields: Field[] | null = block.fields;
  let i = 1;
  while (i < tokens.length && fields) {
    const field: Field | undefined = fields.find((candidate) => candidate.key === tokens[i]);
    if (!field) {
      parts.push(String(tokens[i]));
      break;
    }
    parts.push(field.label[lang]);
    i += 1;
    if (field.kind === "group") fields = field.fields;
    else if (field.kind === "list") {
      if (typeof tokens[i] === "number") {
        parts.push(translate(lang, "list.number", { item: field.itemLabel[lang], n: (tokens[i] as number) + 1 }));
        i += 1;
      }
      fields = typeof field.item === "string" ? null : field.item;
    } else if (field.kind === "image") {
      if (typeof tokens[i] === "string") parts.push(IMAGE_PARTS[tokens[i] as string]?.[lang] ?? String(tokens[i]));
      fields = null;
    } else fields = null;
  }
  return { blockId: block.id, label: parts.join(" › ") };
}

/** usedIn из DELETE /api/admin/media: "site: hero.image.src", "gallery: [3].poster". */
export function describeUsage(entry: string, lang: AdminLang = "ru"): string {
  const at = entry.indexOf(": ");
  const name = entry.slice(0, at);
  const path = entry.slice(at + 2);
  return name === "gallery" ? describePath("gallery", `gallery${path}`, lang).label : describePath("site", path, lang).label;
}

/** Все подписи и подсказки описания — для проверки, что у каждой есть оба языка. */
export function allLabels(): { at: string; text: L }[] {
  const out: { at: string; text: L }[] = [];
  const walk = (fields: Field[], at: string) => {
    for (const field of fields) {
      const here = `${at}.${field.key}`;
      out.push({ at: here, text: field.label });
      if (field.hint) out.push({ at: `${here}:hint`, text: field.hint });
      if (field.kind === "group") walk(field.fields, here);
      if (field.kind === "list") {
        out.push({ at: `${here}:item`, text: field.itemLabel });
        if (typeof field.item !== "string") walk(field.item, `${here}[]`);
      }
    }
  };
  for (const block of BLOCKS) {
    out.push({ at: `${block.id}:title`, text: block.title }, { at: `${block.id}:description`, text: block.description });
    walk(block.fields, block.id);
  }
  for (const anchor of SECTION_ANCHORS) out.push({ at: `#${anchor.id}`, text: anchor.label });
  for (const [name, label] of Object.entries(ICON_LABELS)) out.push({ at: `icon:${name}`, text: label });
  for (const [name, label] of Object.entries({ ...IMAGE_PARTS, ...GALLERY_PARTS })) out.push({ at: `part:${name}`, text: label });
  return out;
}

export { ICON_NAMES };
