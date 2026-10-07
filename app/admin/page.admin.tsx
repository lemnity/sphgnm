import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasAdminSession } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "Админка", robots: { index: false, follow: false } };

// Заглушка: интерфейс админки появится отдельно. Проверка сессии здесь дублирует middleware.
export default async function AdminPage() {
  if (!(await hasAdminSession())) redirect("/admin/login");
  return <main style={{ padding: 24 }}>Админка</main>;
}
