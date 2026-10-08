import { NextResponse, type NextRequest } from "next/server";
import { PROJECT_ROOT, handleError, requestLang, requireAdmin } from "@/lib/admin/guard";
import { listHistory } from "@/lib/admin/storage";

/** GET → { entries: [{ id, name, savedAt, size }] }, новые сверху. */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ entries: await listHistory(PROJECT_ROOT) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleError(error, requestLang(request));
  }
}
