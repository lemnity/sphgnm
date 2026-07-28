// GitHub Pages отдаёт только статические файлы, поэтому сборка идёт в режиме
// экспорта: next build кладёт готовый сайт в ./out.
//
// Сайт живёт по адресу lemnity.github.io/sphgnm/ — в ПОДПАПКЕ, а не в корне
// домена. Без basePath все ссылки на /_next/* ушли бы на lemnity.github.io/_next/*
// и вернули 404: страница открылась бы без стилей и без JS.
//
// Переменную GITHUB_PAGES выставляет только workflow деплоя. Локально она пуста,
// basePath отключён, и `npm run dev` работает на http://localhost:3000/ без префикса.
const isPages = process.env.GITHUB_PAGES === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath: isPages ? "/sphgnm" : "",
  assetPrefix: isPages ? "/sphgnm/" : "",
  // Оптимизатор картинок — серверная штука, в статике его нет. Лендинг его и не
  // использует (везде обычный <img>), но без флага next build падает на проверке.
  images: { unoptimized: true },
};

export default nextConfig;
