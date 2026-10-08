// Проверка и сохранение контента — общая часть PUT /api/admin/content и восстановления из истории.
import { revalidatePath } from "next/cache";
import { validateGallery, validateSiteContent } from "@/lib/content/schema";
import type { AdminLang } from "./i18n.ts";
import { writeContents, type ContentWrite, type WriteResult } from "./storage.ts";

export function validateContent(name: ContentWrite["name"], data: unknown, lang: AdminLang = "ru"): string[] {
  return name === "site" ? validateSiteContent(data, lang) : validateGallery(data, lang);
}

/** Пишет файлы с историей и сбрасывает кэш главной, чтобы next start отдал свежую страницу. */
export async function saveContents(root: string, writes: ContentWrite[]): Promise<Record<string, WriteResult>> {
  const result = await writeContents(root, writes);
  revalidatePath("/");
  return result;
}
