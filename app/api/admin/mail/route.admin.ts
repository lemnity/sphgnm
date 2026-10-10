// Почта в кабинете: папки и список писем Maildir. Только чтение.
import { NextResponse, type NextRequest } from "next/server";
import { apiError, handleError, requestLang, requireAdmin } from "@/lib/admin/guard";
import { connectedMaildir, mailStateFile } from "@/lib/admin/mailbox";
import { INBOX, listFolders, listMessages, loadMailState } from "@/lib/mail/maildir";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET ?folder=INBOX&page=1 → { connected: false } или { connected: true, folders, folder, page, pages, total, messages }.
 * ?counts=1 — только папки со счётчиками (значок в меню), без чтения писем.
 */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const lang = requestLang(request);
  const headers = { "Cache-Control": "no-store" };
  try {
    const root = await connectedMaildir();
    // Не задан или не читается — спокойное «не подключена», а не ошибка.
    if (!root) return NextResponse.json({ connected: false }, { headers });
    const state = await loadMailState(mailStateFile());
    const folders = await listFolders(root, state);
    if (request.nextUrl.searchParams.get("counts") === "1") return NextResponse.json({ connected: true, folders }, { headers });
    const folder = request.nextUrl.searchParams.get("folder") || INBOX;
    if (!folders.some((item) => item.id === folder)) return apiError(lang, 404, "api.messageNotFound");
    const page = Number(request.nextUrl.searchParams.get("page") ?? 1);
    const list = await listMessages(root, folder, { page: Number.isFinite(page) ? page : 1, state });
    return NextResponse.json({ connected: true, folders, folder, ...list }, { headers });
  } catch (error) {
    return handleError(error, lang);
  }
}
