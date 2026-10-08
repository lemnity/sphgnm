import type { Metadata } from "next";
import { getSiteContent } from "@/lib/content/load";
import { absoluteUrl, imageType, siteRoot } from "@/lib/seo";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = getSiteContent();
  // siteUrl уже с подпапкой (/sphgnm на GitHub Pages), basePath к нему не добавляем.
  const url = siteRoot(meta.siteUrl);
  const image = { url: absoluteUrl(meta.siteUrl, meta.image.src), alt: meta.image.alt || meta.title, type: imageType(meta.image.src) };
  return {
    metadataBase: new URL(url),
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.shareDescription,
      url,
      siteName: meta.title,
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.shareDescription,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // lang="en" — сайт одноязычный, английский. Скринридер и переводчик браузера
  // ориентируются именно на этот атрибут.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
