import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminApp } from "@/components/admin/admin-app";
import { PROJECT_ROOT, hasAdminSession } from "@/lib/admin/guard";
import { readContent } from "@/lib/admin/storage";
import { getInstagramPosts } from "@/lib/content/load";
import type { GalleryItem, SiteContent } from "@/lib/content/schema";

export const metadata: Metadata = { title: "Кабинет · Sphagnum Eco", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Проверка сессии здесь дублирует middleware: страница не должна зависеть от matcher.
export default async function AdminPage() {
  if (!(await hasAdminSession())) redirect("/admin/login");
  // Файлы как есть, без проверки схемы: если JSON сломан руками, кабинет всё равно
  // откроется, а ошибки покажет первое сохранение.
  const [site, gallery] = await Promise.all([readContent(PROJECT_ROOT, "site"), readContent(PROJECT_ROOT, "gallery")]);
  return <AdminApp site={site as SiteContent} gallery={gallery as GalleryItem[]} instagramLive={getInstagramPosts().length} />;
}
