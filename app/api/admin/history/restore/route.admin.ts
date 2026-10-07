import { NextResponse, type NextRequest } from "next/server";
import { saveContent, validateContent } from "@/lib/admin/content";
import { PROJECT_ROOT, handleError, jsonError, requireAdmin } from "@/lib/admin/guard";
import { readHistory } from "@/lib/admin/storage";

/** POST { id } → версия становится текущей; текущая при этом сама уходит в историю. */
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let id: unknown;
  try {
    id = (await request.json())?.id;
  } catch {
    return jsonError(400, "Ожидается { id }");
  }
  if (typeof id !== "string") return jsonError(400, "Ожидается { id }");

  try {
    const { name, data } = await readHistory(PROJECT_ROOT, id);
    // Старая версия могла быть сохранена до ужесточения схемы — проверяем как обычное сохранение.
    const errors = validateContent(name, data);
    if (errors.length) return jsonError(422, "Версия не проходит проверку", { errors });
    const history = await saveContent(PROJECT_ROOT, name, data);
    return NextResponse.json({ ok: true, name, restored: id, history });
  } catch (error) {
    return handleError(error);
  }
}
