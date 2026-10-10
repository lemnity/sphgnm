// Публичный приём заявок с формы. Только в серверном режиме (*.admin.ts): в статике API нет.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimitKey } from "@/lib/admin/login";
import { getSiteContent } from "@/lib/content/load";
import { handleLead, leadLimiter, MAX_BODY_BYTES, readBodyLimited, tooLarge, type LeadResult } from "@/lib/lead/handle";
import { sendmailTransport } from "@/lib/lead/mail";
import { sharedLeadStore } from "@/lib/lead/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMAILS_DIR = path.join(process.cwd(), "emails");

function respond(result: LeadResult) {
  const response = NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  if (result.status === 429) response.headers.set("Retry-After", String(result.retryAfter));
  return response;
}

/** POST JSON { name, email, phone, region, projectType, area, message, website } → { ok } или { error, code }. */
export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return respond(tooLarge());
  const rawBody = await readBodyLimited(request.body).catch(() => "");
  if (rawBody === null) return respond(tooLarge());

  // Контент читаем на каждый запрос: правки из кабинета подхватываются без перезапуска.
  const content = getSiteContent();
  const result = await handleLead({
    rawBody,
    key: rateLimitKey(request.headers),
    limiter: leadLimiter(),
    site: { projectTypes: content.contact.form.projectTypes, siteUrl: content.meta.siteUrl, salesEmail: content.contacts.email },
    loadTemplates: async () => ({
      notification: await readFile(path.join(EMAILS_DIR, "lead-notification.html"), "utf8"),
      autoreply: await readFile(path.join(EMAILS_DIR, "lead-autoreply.html"), "utf8"),
    }),
    transport: sendmailTransport(),
    // Заявка сохраняется до письма: кабинет «Заявки» (LEADS_DIR, по умолчанию data/leads).
    store: sharedLeadStore(),
  });
  return respond(result);
}
