// Проверка и сохранение контента — общая часть PUT /api/admin/content и восстановления из истории.
import { revalidatePath } from "next/cache";
import { validateGallery, validateSiteContent } from "@/lib/content/schema";
import { writeContent, type ContentName } from "./storage.ts";

export function validateContent(name: ContentName, data: unknown): string[] {
  return name === "site" ? validateSiteContent(data) : validateGallery(data);
}

/** Пишет файл с историей и сбрасывает кэш главной, чтобы next start отдал свежую страницу. */
export async function saveContent(root: string, name: ContentName, data: unknown): Promise<string | null> {
  const historyId = await writeContent(root, name, data);
  revalidatePath("/");
  return historyId;
}
