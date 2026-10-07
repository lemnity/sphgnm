import type { Metadata } from "next";

export const metadata: Metadata = { title: "Вход в админку", robots: { index: false, follow: false } };

// Заглушка: форма входа появится вместе с интерфейсом админки.
export default function AdminLoginPage() {
  return <main style={{ padding: 24 }}>Вход в админку</main>;
}
