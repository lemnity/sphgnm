// Два режима сборки.
// - Статический (GITHUB_PAGES=true или STATIC_EXPORT=true): GitHub Pages отдаёт
//   только файлы, поэтому next build кладёт готовый сайт в ./out. Админки и API
//   в нём нет.
// - Серверный (по умолчанию: next dev, next build && next start): плюс админка
//   и /api/admin. Их файлы названы *.admin.tsx / *.admin.ts и становятся
//   страницами и роутами только через pageExtensions ниже — в статике Next их
//   просто не видит.
//
// Сайт живёт по адресу lemnity.github.io/sphgnm/ — в ПОДПАПКЕ, а не в корне
// домена. Без basePath все ссылки на /_next/* ушли бы на lemnity.github.io/_next/*
// и вернули 404: страница открылась бы без стилей и без JS.
//
// Переменную GITHUB_PAGES выставляет только workflow деплоя. Локально она пуста,
// basePath отключён, и `npm run dev` работает на http://localhost:3000/ без префикса.
const isPages = process.env.GITHUB_PAGES === "true";
const isStatic = isPages || process.env.STATIC_EXPORT === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: isStatic ? "export" : undefined,
  pageExtensions: isStatic ? ["tsx", "ts", "jsx", "js"] : ["tsx", "ts", "jsx", "js", "admin.tsx", "admin.ts"],
  basePath: isPages ? "/sphgnm" : "",
  // БЕЗ хвостового слэша. С ним Next склеивал префикс с "/_next/..." и выдавал
  // "/sphgnm//_next/static/media/...": статически импортированные картинки
  // получали двойной слэш. GitHub Pages его прощает, но это везение — другой
  // хостинг или CDN на таком пути отдаст 404.
  assetPrefix: isPages ? "/sphgnm" : "",
  // Картинки постов Instagram лежат в public/instagram и подставляются строкой,
  // а не импортом — префикс подпапки компонент дописывает сам из этой переменной.
  env: { NEXT_PUBLIC_BASE_PATH: isPages ? "/sphgnm" : "" },
  // Оптимизатор картинок — серверная штука, в статике его нет. Лендинг его и не
  // использует (везде обычный <img>), но без флага next build падает на проверке.
  images: { unoptimized: true },
};

export default nextConfig;
