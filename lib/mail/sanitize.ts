// Очистка HTML письма перед показом в кабинете. Вторая линия обороны: письмо всё равно
// рисуется в <iframe sandbox=""> с CSP. Без DOM и зависимостей — работает на сервере.

/** Элементы, которые вырезаются вместе с содержимым. */
const DROP_WITH_CONTENT = new Set(["script", "iframe", "object", "applet", "frameset", "frame", "noembed", "noframes", "template", "xmp", "plaintext"]);
/** Теги, которые вырезаются, а содержимое остаётся (или его нет). */
const DROP_TAG = new Set(["embed", "form", "meta", "base", "link", "animate", "set", "animatemotion", "animatetransform", "param", "portal"]);
/** Атрибуты со ссылками. */
const URL_ATTRS = new Set(["href", "src", "action", "formaction", "xlink:href", "background", "poster", "lowsrc", "dynsrc", "cite", "longdesc", "usemap", "ping", "data", "codebase", "srcset"]);

const NAMED: Record<string, string> = { colon: ":", tab: "\t", newline: "\n", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", sol: "/", lpar: "(", rpar: ")" };

/** Сущности в значении атрибута — чтобы «jav&#x61;script:» не прошёл проверку. */
function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/** Опасная схема: javascript:, vbscript:, data: (кроме картинок в src). */
export function isDangerousUrl(value: string, allowDataImage = false): boolean {
  // eslint-disable-next-line no-control-regex
  const url = decodeEntities(value).replace(/[\u0000- \u007f-\u009f]+/g, "").toLowerCase();
  if (/^(javascript|vbscript|livescript|mocha):/.test(url)) return true;
  if (url.startsWith("data:")) return !(allowDataImage && /^data:image\/(png|jpe?g|gif|webp|bmp);/.test(url));
  return false;
}

type Attr = { name: string; value: string | null };

/** Разбор атрибутов от позиции start до «>»; возвращает атрибуты и позицию после тега. */
function readTag(html: string, start: number): { attrs: Attr[]; end: number; selfClosing: boolean } {
  const attrs: Attr[] = [];
  let i = start;
  let selfClosing = false;
  while (i < html.length) {
    const char = html[i];
    if (char === ">") return { attrs, end: i + 1, selfClosing };
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (char === "/") {
      selfClosing = html[i + 1] === ">";
      i++;
      continue;
    }
    let name = "";
    while (i < html.length && !/[\s/>=]/.test(html[i])) name += html[i++];
    if (!name) {
      i++;
      continue;
    }
    while (i < html.length && /\s/.test(html[i])) i++;
    let value: string | null = null;
    if (html[i] === "=") {
      i++;
      while (i < html.length && /\s/.test(html[i])) i++;
      const quote = html[i];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, i + 1);
        value = html.slice(i + 1, close < 0 ? html.length : close);
        i = close < 0 ? html.length : close + 1;
      } else {
        value = "";
        while (i < html.length && !/[\s>]/.test(html[i])) value += html[i++];
      }
    }
    attrs.push({ name: name.toLowerCase(), value });
  }
  return { attrs, end: html.length, selfClosing };
}

function cleanAttrs(tag: string, attrs: Attr[]): Attr[] {
  const out: Attr[] = [];
  for (const attr of attrs) {
    const { name, value } = attr;
    if (name.startsWith("on") || name === "srcdoc" || name === "formaction" || name === "target" || name === "ping") continue;
    if (!/^[a-z_:][a-z0-9_:.-]*$/.test(name)) continue;
    if (value !== null && URL_ATTRS.has(name)) {
      // Ссылки в песочнице не открываются; адрес остаётся подсказкой при наведении.
      if ((tag === "a" || tag === "area") && name === "href") {
        if (!isDangerousUrl(value)) out.push({ name: "title", value });
        continue;
      }
      if (name === "srcset") {
        if (value.split(",").some((item) => isDangerousUrl(item.trim()))) continue;
      } else if (isDangerousUrl(value, name === "src" && tag === "img")) continue;
    }
    if (name === "style" && value !== null && /expression\s*\(|javascript:|behavior\s*:|-moz-binding/i.test(decodeEntities(value))) continue;
    out.push(attr);
  }
  return out;
}

const attrText = ({ name, value }: Attr) => (value === null ? ` ${name}` : ` ${name}="${value.replace(/"/g, "&quot;")}"`);

/** HTML письма без скриптов, фреймов, форм, обработчиков on*, javascript:-ссылок и meta refresh. */
export function sanitizeHtml(html: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      const end = html.indexOf(">", lt);
      i = end < 0 ? html.length : end + 1;
      continue;
    }
    const match = /^<(\/?)([A-Za-z][A-Za-z0-9:-]*)/.exec(html.slice(lt, lt + 64));
    if (!match) {
      out += "&lt;";
      i = lt + 1;
      continue;
    }
    const closing = match[1] === "/";
    const name = match[2].toLowerCase();
    const tag = readTag(html, lt + match[0].length);
    i = tag.end;
    if (DROP_WITH_CONTENT.has(name)) {
      if (closing) continue;
      // Пропускаем до закрывающего тега (или до конца, если его нет).
      const close = new RegExp(`</${name}[\\s/>]`, "i").exec(html.slice(i));
      if (!close) {
        i = html.length;
        continue;
      }
      const after = html.indexOf(">", i + close.index);
      i = after < 0 ? html.length : after + 1;
      continue;
    }
    if (DROP_TAG.has(name)) continue;
    if (closing) {
      out += `</${name}>`;
      continue;
    }
    out += `<${name}${cleanAttrs(name, tag.attrs).map(attrText).join("")}${tag.selfClosing ? " /" : ""}>`;
  }
  return out;
}

/** CSP документа письма: без сети; картинки по https — только по кнопке. */
export function mailCsp(showImages: boolean): string {
  return `default-src 'none'; style-src 'unsafe-inline'; img-src data:${showImages ? " https:" : ""}; font-src data:`;
}

/** Документ для <iframe sandbox="" srcdoc>: CSP первым делом, затем очищенное письмо. */
export function buildSrcdoc(cleanHtml: string, showImages: boolean): string {
  return [
    "<!doctype html><html><head>",
    `<meta http-equiv="Content-Security-Policy" content="${mailCsp(showImages)}">`,
    '<meta charset="utf-8">',
    "<style>body{margin:16px;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#102b20;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:#3e5042}</style>",
    "</head><body>",
    cleanHtml,
    "</body></html>",
  ].join("");
}
