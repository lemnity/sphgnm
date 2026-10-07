import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/admin/guard";
import { attemptLogin, rateLimitKey } from "@/lib/admin/login";
import { loginLimiter } from "@/lib/admin/rate-limit";
import { SESSION_COOKIE, createSessionToken, resolveSessionSecret, sessionCookieOptions } from "@/lib/admin/session";

/** POST { password } (JSON или form) → cookie сессии. */
export async function POST(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) {
    const hint = process.env.NODE_ENV === "production" ? "" : " Задайте ADMIN_PASSWORD в .env.local (см. .env.example) и перезапустите сервер.";
    return jsonError(500, `Вход отключён: не задан пароль администратора.${hint}`);
  }
  const secret = resolveSessionSecret();
  if ("error" in secret) return jsonError(500, secret.error);

  // Тело читается до проверки лимита — не даём читать большие тела.
  if (Number(request.headers.get("content-length") ?? 0) > 16 * 1024) return jsonError(413, "Слишком большой запрос");

  const result = await attemptLogin({
    readPassword: async () => {
      const type = request.headers.get("content-type") ?? "";
      return type.includes("application/json") ? (await request.json())?.password : (await request.formData()).get("password");
    },
    key: rateLimitKey(request.headers),
    expected: password,
    limiter: loginLimiter(),
  });

  if (result.status === 429) {
    const response = jsonError(429, result.error, { retryAfter: result.retryAfter });
    response.headers.set("Retry-After", String(result.retryAfter));
    return response;
  }
  if (result.status !== 200) return jsonError(result.status, result.error);

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, createSessionToken(secret.secret), sessionCookieOptions());
  return response;
}
