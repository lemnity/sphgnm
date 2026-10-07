import { NextResponse, type NextRequest } from "next/server";
import { PROJECT_ROOT, handleError, jsonError, requireAdmin } from "@/lib/admin/guard";
import { MAX_UPLOAD_BYTES, saveUpload } from "@/lib/admin/storage";

/** POST multipart/form-data, поле file → { path: "uploads/<id>.<ext>" }. */
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  // Отсекаем заведомо большие файлы до того, как тело целиком окажется в памяти.
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 1024 * 1024) return jsonError(413, "Файл больше 150 МБ");

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return jsonError(400, "Ожидается multipart/form-data с полем file");
  }
  if (!file || typeof file === "string") return jsonError(400, "Нет файла в поле file");

  try {
    const path = await saveUpload(PROJECT_ROOT, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
    return NextResponse.json({ path });
  } catch (error) {
    return handleError(error);
  }
}
