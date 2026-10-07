// Два режима сборки:
// - статический (GITHUB_PAGES=true или STATIC_EXPORT=true) — готовый сайт в ./out,
//   без админки и API;
// - серверный (next dev, next build && next start) — плюс админка и /api/admin.
//   Их файлы названы *.admin.ts(x) и становятся страницами только через pageExtensions.
// На GitHub Pages сайт живёт в подпапке /sphgnm, поэтому там нужен basePath;
// GITHUB_PAGES выставляет только workflow деплоя.
const isPages = process.env.GITHUB_PAGES === "true";
const isStatic = isPages || process.env.STATIC_EXPORT === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: isStatic ? "export" : undefined,
  pageExtensions: isStatic ? ["tsx", "ts", "jsx", "js"] : ["tsx", "ts", "jsx", "js", "admin.tsx", "admin.ts"],
  basePath: isPages ? "/sphgnm" : "",
  // Без хвостового слэша: с ним импортированные картинки получали "/sphgnm//_next/…".
  assetPrefix: isPages ? "/sphgnm" : "",
  // Файлы из public подставляются строкой, префикс подпапки дописывает withBase (lib/media.ts).
  env: { NEXT_PUBLIC_BASE_PATH: isPages ? "/sphgnm" : "" },
  // Оптимизатора картинок в статике нет; лендинг везде использует обычный <img>.
  images: { unoptimized: true },
};

export default nextConfig;
