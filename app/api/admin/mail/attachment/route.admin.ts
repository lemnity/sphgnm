// Вложение письма — только скачиванием: attachment, octet-stream, nosniff, без показа в браузере.
import { type NextRequest } from "next/server";
import { apiError, handleError, requestLang, requireAdmin } from "@/lib/admin/guard";
import { attachmentDisposition, connectedMaildir, messageRef } from "@/lib/admin/mailbox";
import { findMessage, readMessageFile } from "@/lib/mail/maildir";
import { getAttachment } from "@/lib/mail/parse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET ?folder=&id=&index= → файл. */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const lang = requestLang(request);
  const ref = messageRef(request.nextUrl.searchParams);
  const index = request.nextUrl.searchParams.get("index") ?? "";
  if (!ref || !/^\d{1,4}$/.test(index)) return apiError(lang, 400, "api.badId");
  try {
    const root = await connectedMaildir();
    if (!root) return apiError(lang, 404, "api.mailNotConnected");
    const entry = await findMessage(root, ref.folder, ref.id);
    if (!entry) return apiError(lang, 404, "api.messageNotFound");
    const attachment = getAttachment(await readMessageFile(entry), Number(index));
    if (!attachment) return apiError(lang, 404, "api.attachmentNotFound");
    return new Response(new Uint8Array(attachment.data), {
      headers: {
        // Тип из письма не доверяем: браузер не должен ничего открывать сам.
        "Content-Type": "application/octet-stream",
        "Content-Disposition": attachmentDisposition(attachment.name),
        "Content-Length": String(attachment.data.length),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleError(error, lang);
  }
}
