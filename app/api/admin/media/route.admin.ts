import { NextResponse, type NextRequest } from "next/server";
import { PROJECT_ROOT, handleError, jsonError, requireAdmin } from "@/lib/admin/guard";
import { CONTENT_NAMES, deleteUpload, findUsages, listUploads, readContent, resolveUploadPath } from "@/lib/admin/storage";

/** GET → { files: [{ path, kind, size, modifiedAt }] }, новые сверху. */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ files: await listUploads(PROJECT_ROOT) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleError(error);
  }
}

/** DELETE ?path=uploads/<имя>. Файл, который ещё стоит в контенте, не удаляем: 409 { usedIn }. */
export async function DELETE(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const target = request.nextUrl.searchParams.get("path") ?? "";
  try {
    resolveUploadPath(PROJECT_ROOT, target);
    const usedIn: string[] = [];
    for (const name of CONTENT_NAMES) {
      usedIn.push(...findUsages(await readContent(PROJECT_ROOT, name), target).map((at) => `${name}: ${at}`));
    }
    if (usedIn.length) return jsonError(409, "Файл используется на сайте — сначала замените его в контенте", { usedIn });
    await deleteUpload(PROJECT_ROOT, target);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
