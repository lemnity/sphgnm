// Все заявки одной таблицей для Excel: UTF-8 с BOM, подписи на языке кабинета.
import { type NextRequest } from "next/server";
import { handleError, requestLang, requireAdmin } from "@/lib/admin/guard";
import { translate, type MessageKey } from "@/lib/admin/i18n";
import { TIME_ZONE } from "@/lib/lead/render";
import { sharedLeadStore, toCsv, type StoredLead } from "@/lib/lead/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// «2026-10-10 14:05» по Дубаю — Excel понимает как дату.
const dubai = new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const STATUS: Record<StoredLead["mailStatus"], MessageKey> = { sent: "leads.csvSent", failed: "leads.csvFailed", pending: "leads.csvPending" };

/** GET → text/csv, attachment. */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const lang = requestLang(request);
  try {
    const leads = await sharedLeadStore().list();
    const t = (key: MessageKey) => translate(lang, key);
    const header = [
      t("leads.col.id"),
      t("leads.csvDate"),
      t("leads.col.name"),
      t("leads.col.email"),
      t("leads.col.phone"),
      t("leads.col.region"),
      t("leads.col.projectType"),
      t("leads.col.area"),
      t("leads.col.message"),
      t("leads.col.mailStatus"),
      t("leads.col.read"),
    ];
    const rows = leads.map((lead) => [
      lead.id,
      dubai.format(new Date(lead.submittedAt)),
      lead.name,
      lead.email,
      lead.phone,
      lead.region,
      lead.projectType,
      lead.area,
      lead.message,
      t(STATUS[lead.mailStatus]),
      t(lead.read ? "ui.yes" : "ui.no"),
    ]);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(toCsv(header, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${day}.csv"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleError(error, lang);
  }
}
