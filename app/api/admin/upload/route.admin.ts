import { NextResponse, type NextRequest } from "next/server";
import { PROJECT_ROOT, apiError, handleError, requestLang, requireAdmin } from "@/lib/admin/guard";
import { MAX_UPLOAD_BYTES, saveUpload } from "@/lib/admin/storage";

/** POST multipart/form-data, поле file → { path: "uploads/<id>.<ext>" }. */
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const lang = requestLang(request);

  // Отсекаем заведомо большие файлы до того, как тело целиком окажется в памяти.
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 1024 * 1024) return apiError(lang, 413, "api.fileTooBig", { mb: MAX_UPLOAD_BYTES / 1024 / 1024 });

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return apiError(lang, 400, "api.expectedMultipart");
  }
  if (!file || typeof file === "string") return apiError(lang, 400, "api.noFile");

  try {
    const path = await saveUpload(PROJECT_ROOT, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
    return NextResponse.json({ path });
  } catch (error) {
    return handleError(error, lang);
  }
}
