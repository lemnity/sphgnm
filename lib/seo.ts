// Абсолютные адреса для превью ссылок (Open Graph, Twitter). Без зависимостей — гоняется node --test.

/**
 * Правило: siteUrl — полный публичный адрес сайта ВМЕСТЕ с подпапкой (https://lemnity.github.io/sphgnm),
 * поэтому basePath (NEXT_PUBLIC_BASE_PATH) к абсолютным адресам не добавляется — иначе /sphgnm задвоится.
 */
export function siteRoot(siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/`;
}

/** Путь из public ("media/x.webp") → абсолютный URL от адреса сайта. */
export function absoluteUrl(siteUrl: string, path: string): string {
  return new URL(path.replace(/^\/+/, ""), siteRoot(siteUrl)).href;
}

/** MIME превью по расширению: подсказка соцсетям, тип не обязателен. */
export function imageType(path: string): string | undefined {
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
  return ext ? ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif" } as Record<string, string>)[ext] : undefined;
}
