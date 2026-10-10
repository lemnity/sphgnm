// Одно письмо: заголовки, текст, очищенный HTML, список вложений. Открытие отмечает
// письмо прочитанным — в data/mail-state.json, файлы Maildir не трогаются.
import { NextResponse, type NextRequest } from "next/server";
import { apiError, handleError, requestLang, requireAdmin } from "@/lib/admin/guard";
import { connectedMaildir, mailStateFile, messageRef } from "@/lib/admin/mailbox";
import { allMessageIds, findMessage, readMessageFile, setMailRead } from "@/lib/mail/maildir";
import { parseMessage } from "@/lib/mail/parse";
import { sanitizeHtml } from "@/lib/mail/sanitize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

/** GET ?folder=&id= → { message }. */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const lang = requestLang(request);
  const ref = messageRef(request.nextUrl.searchParams);
  if (!ref) return apiError(lang, 400, "api.badId");
  try {
    const root = await connectedMaildir();
    if (!root) return apiError(lang, 404, "api.mailNotConnected");
    const entry = await findMessage(root, ref.folder, ref.id);
    if (!entry) return apiError(lang, 404, "api.messageNotFound");
    const parsed = parseMessage(await readMessageFile(entry));
    // Заодно чистим отметки писем, которых в Maildir уже нет.
    await setMailRead(mailStateFile(), entry.id, true, await allMessageIds(root)).catch((error) => console.error("[mail] отметка «прочитано» не записана:", (error as NodeJS.ErrnoException).code ?? error));
    return NextResponse.json(
      {
        message: {
          id: entry.id,
          folder: ref.folder,
          size: entry.size,
          from: parsed.from,
          to: parsed.to,
          cc: parsed.cc,
          subject: parsed.subject,
          date: parsed.date ?? new Date(entry.time).toISOString(),
          text: parsed.text,
          html: parsed.html ? sanitizeHtml(parsed.html) : "",
          attachments: parsed.attachments,
          truncated: parsed.truncated,
        },
      },
      { headers: noStore },
    );
  } catch (error) {
    return handleError(error, lang);
  }
}

/** PATCH ?folder=&id= { read } → { ok }. */
export async function PATCH(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const lang = requestLang(request);
  const ref = messageRef(request.nextUrl.searchParams);
  if (!ref) return apiError(lang, 400, "api.badId");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(lang, 400, "api.invalidJson");
  }
  const read = body && typeof body === "object" ? (body as { read?: unknown }).read : undefined;
  if (typeof read !== "boolean") return apiError(lang, 400, "api.expectedRead");
  try {
    const root = await connectedMaildir();
    if (!root) return apiError(lang, 404, "api.mailNotConnected");
    const entry = await findMessage(root, ref.folder, ref.id);
    if (!entry) return apiError(lang, 404, "api.messageNotFound");
    await setMailRead(mailStateFile(), entry.id, read, await allMessageIds(root));
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return handleError(error, lang);
  }
}
