import { NextResponse, type NextRequest } from "next/server";
import { saveContents, validateContent } from "@/lib/admin/content";
import { PROJECT_ROOT, apiError, handleError, jsonError, requestLang, requireAdmin } from "@/lib/admin/guard";
import { translate } from "@/lib/admin/i18n";
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
    return handleError(error, requestLang(request));
  }
}

/**
 * PUT { site?, gallery?, versions: { site?, gallery? } } → проверка обоих, потом запись.
 * Тексты — на языке запроса (requestLang), у каждой ошибки есть code.
 * Ошибки данных → 400 { error, code: "validation", errors[] }; файл изменился после чтения → 409 { error, conflict[] }.
 * Успех → { ok, saved, history, versions } с новыми версиями сохранённых разделов.
 */
export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const lang = requestLang(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(lang, 400, "api.invalidJson");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError(lang, 400, "api.expectedContent");

  const { versions: rawVersions, ...record } = body as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter((key) => !(CONTENT_NAMES as readonly string[]).includes(key));
  const names = CONTENT_NAMES.filter((name) => name in record);
  if (unknownKeys.length || names.length === 0) {
    return apiError(lang, 400, "api.expectedContent", {}, { errors: unknownKeys.map((key) => `${key}: ${translate(lang, "api.unknownSection")}`) });
  }
  const versions = parseVersions(rawVersions, names, lang);
  if (typeof versions === "string") return jsonError(400, versions, { code: "missingVersion" });

  // Сначала проверяем всё, потом пишем: не сохраняем site, если gallery с ошибками.
  const errors = names.flatMap((name) => validateContent(name, record[name], lang));
  if (errors.length) return apiError(lang, 400, "api.validation", {}, { errors });

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
    return handleError(error, lang);
  }
}
