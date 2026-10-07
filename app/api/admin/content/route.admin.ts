import { NextResponse, type NextRequest } from "next/server";
import { saveContent, validateContent } from "@/lib/admin/content";
import { PROJECT_ROOT, handleError, jsonError, requireAdmin } from "@/lib/admin/guard";
import { CONTENT_NAMES, readContent } from "@/lib/admin/storage";

/** GET → { site, gallery } — файлы как есть. */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const [site, gallery] = await Promise.all([readContent(PROJECT_ROOT, "site"), readContent(PROJECT_ROOT, "gallery")]);
    return NextResponse.json({ site, gallery }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleError(error);
  }
}

/** PUT { site?, gallery? } → проверка обоих, потом запись. Ошибки → 400 { error, errors[] }. */
export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Невалидный JSON в запросе");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError(400, "Ожидается { site } и/или { gallery }");

  const record = body as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter((key) => !(CONTENT_NAMES as readonly string[]).includes(key));
  const names = CONTENT_NAMES.filter((name) => name in record);
  if (unknownKeys.length || names.length === 0) {
    return jsonError(400, "Ожидается { site } и/или { gallery }", { errors: unknownKeys.map((key) => `${key}: неизвестный раздел`) });
  }

  // Сначала проверяем всё, потом пишем: не сохраняем site, если gallery с ошибками.
  const errors = names.flatMap((name) => validateContent(name, record[name]));
  if (errors.length) return jsonError(400, "Ошибки в данных", { errors });

  try {
    const history: Record<string, string | null> = {};
    for (const name of names) history[name] = await saveContent(PROJECT_ROOT, name, record[name]);
    return NextResponse.json({ ok: true, saved: names, history });
  } catch (error) {
    return handleError(error);
  }
}
