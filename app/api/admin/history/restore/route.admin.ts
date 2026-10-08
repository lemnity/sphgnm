import { NextResponse, type NextRequest } from "next/server";
import { saveContents, validateContent } from "@/lib/admin/content";
import { PROJECT_ROOT, apiError, handleError, requestLang, requireAdmin } from "@/lib/admin/guard";
import { readHistory } from "@/lib/admin/storage";

/**
 * POST { id } → версия становится текущей; текущая при этом сама уходит в историю.
 * Ответ: { ok, name, restored, history, version } — version новая версия раздела.
 */
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const lang = requestLang(request);

  let id: unknown;
  try {
    id = (await request.json())?.id;
  } catch {
    return apiError(lang, 400, "api.expectedId");
  }
  if (typeof id !== "string") return apiError(lang, 400, "api.expectedId");

  try {
    const { name, data } = await readHistory(PROJECT_ROOT, id);
    // Старая версия могла быть сохранена до ужесточения схемы — проверяем как обычное сохранение.
    const errors = validateContent(name, data, lang);
    if (errors.length) return apiError(lang, 422, "api.versionInvalid", {}, { errors });
    const { [name]: saved } = await saveContents(PROJECT_ROOT, [{ name, data }]);
    return NextResponse.json({ ok: true, name, restored: id, history: saved.history, version: saved.version });
  } catch (error) {
    return handleError(error, lang);
  }
}
