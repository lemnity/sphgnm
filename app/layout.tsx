import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SPHAGNUM ECO — Natural Substrates",
  description:
    "Living substrates for green roofs, vertical gardens and interiors. Live Sphagnum Fuscum and mineral-organic green-roof substrates engineered for hot climates, roof-load limits and water scarcity.",
  openGraph: {
    title: "SPHAGNUM ECO — Natural Substrates",
    description: "Living substrates for green roofs, vertical gardens and interiors.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // lang="en" — сайт одноязычный, английский. Скринридер и переводчик браузера
  // ориентируются именно на этот атрибут.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
