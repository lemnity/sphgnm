import { NextResponse, type NextRequest } from "next/server";
import { clientIp, jsonError } from "@/lib/admin/guard";
import { loginLimiter } from "@/lib/admin/rate-limit";
import { SESSION_COOKIE, checkPassword, createSessionToken, resolveSessionSecret, sessionCookieOptions } from "@/lib/admin/session";

/** POST { password } (JSON или form) → cookie сессии. */
export async function POST(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) {
    const hint = process.env.NODE_ENV === "production" ? "" : " Задайте ADMIN_PASSWORD в .env.local (см. .env.example) и перезапустите сервер.";
    return jsonError(500, `Вход отключён: не задан пароль администратора.${hint}`);
  }
  const secret = resolveSessionSecret();
  if ("error" in secret) return jsonError(500, secret.error);

  const limiter = loginLimiter();
  const ip = clientIp(request);
  const wait = limiter.retryAfter(ip);
  if (wait > 0) {
    const seconds = Math.ceil(wait / 1000);
    const response = jsonError(429, `Слишком много попыток. Попробуйте через ${Math.ceil(seconds / 60)} мин.`, { retryAfter: seconds });
    response.headers.set("Retry-After", String(seconds));
    return response;
  }

  let input: unknown;
  try {
    const type = request.headers.get("content-type") ?? "";
    input = type.includes("application/json") ? (await request.json())?.password : (await request.formData()).get("password");
  } catch {
    return jsonError(400, "Ожидается { password }");
  }

  if (typeof input !== "string" || !checkPassword(input, password)) {
    limiter.fail(ip);
    return jsonError(401, "Неверный пароль");
  }

  limiter.reset(ip);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, createSessionToken(secret.secret), sessionCookieOptions());
  return response;
}
