// Одна заявка: просмотр, отметка «прочитано», удаление. Номер проверяется строго —
// в путь к файлу попадает только YYMMDD-XXXX.
import { NextResponse, type NextRequest } from "next/server";
import { apiError, handleError, requestLang, requireAdmin } from "@/lib/admin/guard";
import { LEAD_ID_RE, sharedLeadStore } from "@/lib/lead/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
const noStore = { "Cache-Control": "no-store" };

/** GET → { lead }. */
export async function GET(request: NextRequest, { params }: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const lang = requestLang(request);
  const { id } = await params;
  if (!LEAD_ID_RE.test(id)) return apiError(lang, 400, "api.badId");
  try {
    const lead = await sharedLeadStore().get(id);
    return lead ? NextResponse.json({ lead }, { headers: noStore }) : apiError(lang, 404, "api.leadNotFound");
  } catch (error) {
    return handleError(error, lang);
  }
}

/** PATCH { read: boolean } → { lead }. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const lang = requestLang(request);
  const { id } = await params;
  if (!LEAD_ID_RE.test(id)) return apiError(lang, 400, "api.badId");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(lang, 400, "api.invalidJson");
  }
  const read = body && typeof body === "object" ? (body as { read?: unknown }).read : undefined;
  if (typeof read !== "boolean") return apiError(lang, 400, "api.expectedRead");
  try {
    const lead = await sharedLeadStore().update(id, { read });
    return lead ? NextResponse.json({ lead }, { headers: noStore }) : apiError(lang, 404, "api.leadNotFound");
  } catch (error) {
    return handleError(error, lang);
  }
}

/** DELETE → { ok }. */
export async function DELETE(request: NextRequest, { params }: Context) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const lang = requestLang(request);
  const { id } = await params;
  if (!LEAD_ID_RE.test(id)) return apiError(lang, 400, "api.badId");
  try {
    return (await sharedLeadStore().remove(id)) ? NextResponse.json({ ok: true }, { headers: noStore }) : apiError(lang, 404, "api.leadNotFound");
  } catch (error) {
    return handleError(error, lang);
  }
}
