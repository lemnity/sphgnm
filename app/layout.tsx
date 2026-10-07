import type { Metadata } from "next";
import { getSiteContent } from "@/lib/content/load";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = getSiteContent();
  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.shareDescription,
      type: "website",
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
