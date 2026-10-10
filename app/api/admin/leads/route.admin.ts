// Заявки с формы для кабинета: список. Только серверный режим (*.admin.ts).
import { NextResponse, type NextRequest } from "next/server";
import { handleError, requestLang, requireAdmin } from "@/lib/admin/guard";
import { sharedLeadStore } from "@/lib/lead/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET → { leads: [...], unread }, новые сверху. */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const leads = await sharedLeadStore().list();
    return NextResponse.json({ leads, unread: leads.filter((lead) => !lead.read).length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleError(error, requestLang(request));
  }
}
