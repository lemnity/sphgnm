import { NextResponse, type NextRequest } from "next/server";
import { apiError, requestLang } from "@/lib/admin/guard";
import { attemptLogin, rateLimitKey } from "@/lib/admin/login";
import { loginLimiter } from "@/lib/admin/rate-limit";
import { SESSION_COOKIE, createSessionToken, resolveSessionSecret, sessionCookieOptions } from "@/lib/admin/session";

/** POST { password } (JSON или form) → cookie сессии. */
export async function POST(request: NextRequest) {
  const lang = requestLang(request);
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) return apiError(lang, 500, process.env.NODE_ENV === "production" ? "api.noPassword" : "api.noPasswordDev");
  const secret = resolveSessionSecret(process.env, lang);
  if ("error" in secret) return apiError(lang, 500, secret.key, secret.params);

  // Тело читается до проверки лимита — не даём читать большие тела.
  if (Number(request.headers.get("content-length") ?? 0) > 16 * 1024) return apiError(lang, 413, "api.requestTooLarge");

  const result = await attemptLogin({
    readPassword: async () => {
      const type = request.headers.get("content-type") ?? "";
      return type.includes("application/json") ? (await request.json())?.password : (await request.formData()).get("password");
    },
    key: rateLimitKey(request.headers),
    expected: password,
    limiter: loginLimiter(),
    lang,
  });

  if (result.status === 429) {
    const response = apiError(lang, 429, "api.tooManyAttempts", { minutes: Math.ceil(result.retryAfter / 60) }, { retryAfter: result.retryAfter });
    response.headers.set("Retry-After", String(result.retryAfter));
    return response;
  }
  if (result.status !== 200) return apiError(lang, result.status, `api.${result.code}`);

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, createSessionToken(secret.secret), sessionCookieOptions());
  return response;
}
