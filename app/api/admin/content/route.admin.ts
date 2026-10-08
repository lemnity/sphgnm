import { NextResponse, type NextRequest } from "next/server";
import { saveContents, validateContent } from "@/lib/admin/content";
import { PROJECT_ROOT, handleError, jsonError, requireAdmin } from "@/lib/admin/guard";
import { CONTENT_NAMES, parseVersions, readContentWithVersion } from "@/lib/admin/storage";

/** GET → { site, gallery, versions: { site, gallery } } — файлы как есть и их версии. */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const [site, gallery] = await Promise.all([readContentWithVersion(PROJECT_ROOT, "site"), readContentWithVersion(PROJECT_ROOT, "gallery")]);
    return NextResponse.json(
      { site: site.data, gallery: gallery.data, versions: { site: site.version, gallery: gallery.version } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT { site?, gallery?, versions: { site?, gallery? } } → проверка обоих, потом запись.
 * Ошибки данных → 400 { error, errors[] }; файл изменился после чтения → 409 { error, conflict[] }.
 * Успех → { ok, saved, history, versions } с новыми версиями сохранённых разделов.
 */
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

  const { versions: rawVersions, ...record } = body as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter((key) => !(CONTENT_NAMES as readonly string[]).includes(key));
  const names = CONTENT_NAMES.filter((name) => name in record);
  if (unknownKeys.length || names.length === 0) {
    return jsonError(400, "Ожидается { site } и/или { gallery }", { errors: unknownKeys.map((key) => `${key}: неизвестный раздел`) });
  }
  const versions = parseVersions(rawVersions, names);
  if (typeof versions === "string") return jsonError(400, versions);

  // Сначала проверяем всё, потом пишем: не сохраняем site, если gallery с ошибками.
  const errors = names.flatMap((name) => validateContent(name, record[name]));
  if (errors.length) return jsonError(400, "Ошибки в данных", { errors });

  try {
    const result = await saveContents(
      PROJECT_ROOT,
      names.map((name) => ({ name, data: record[name], expected: versions[name] })),
    );
    const history: Record<string, string | null> = {};
    const saved: Record<string, string> = {};
    for (const name of names) {
      history[name] = result[name].history;
      saved[name] = result[name].version;
    }
    return NextResponse.json({ ok: true, saved: names, history, versions: saved });
  } catch (error) {
    return handleError(error);
  }
}
