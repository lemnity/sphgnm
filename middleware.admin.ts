// Закрывает админку и её API. Файл с расширением .admin.ts — в статической сборке
// Next его не видит (см. pageExtensions в next.config.mjs), как и сами страницы админки.
// Роуты API всё равно проверяют сессию сами (lib/admin/guard.ts).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, resolveSessionSecret, verifySessionToken } from "@/lib/admin/session";

function isAdminRequest(request: NextRequest): boolean {
  const result = resolveSessionSecret();
  return "secret" in result && verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, result.secret);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/admin/login") return NextResponse.next();

  const authed = isAdminRequest(request);
  if (pathname === "/admin/login") {
    return authed ? NextResponse.redirect(new URL("/admin", request.url)) : NextResponse.next();
  }
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Нужно войти в админку" }, { status: 401 });
  }
  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // node:crypto для проверки подписи — нужен Node-рантайм, а не Edge.
  runtime: "nodejs",
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
