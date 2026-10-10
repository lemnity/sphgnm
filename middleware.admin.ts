// Закрывает админку и её API. Файл с расширением .admin.ts — в статической сборке
// Next его не видит (см. pageExtensions в next.config.mjs), как и сами страницы админки.
// Роуты API всё равно проверяют сессию сами (lib/admin/guard.ts).
import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, LANG_HEADER, codeOf, pickLang, translate } from "@/lib/admin/i18n";
import { SESSION_COOKIE, resolveSessionSecret, verifySessionToken } from "@/lib/admin/session";

function isAdminRequest(request: NextRequest): boolean {
  const result = resolveSessionSecret();
  return "secret" in result && verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, result.secret);
}

// Относительный Location: за nginx request.url указывает на 127.0.0.1:3000,
// а браузер сам подставит домен, с которого пришёл.
function redirectTo(location: string) {
  return new NextResponse(null, { status: 307, headers: { Location: location } });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/admin/login") return NextResponse.next();

  const authed = isAdminRequest(request);
  if (pathname === "/admin/login") {
    return authed ? redirectTo("/admin") : NextResponse.next();
  }
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    const lang = pickLang({
      header: request.headers.get(LANG_HEADER),
      cookie: request.cookies.get(LANG_COOKIE)?.value,
      acceptLanguage: request.headers.get("accept-language"),
    });
    return NextResponse.json({ error: translate(lang, "api.unauthorized"), code: codeOf("api.unauthorized") }, { status: 401 });
  }
  return redirectTo(`/admin/login?next=${encodeURIComponent(pathname)}`);
}

export const config = {
  // node:crypto для проверки подписи — нужен Node-рантайм, а не Edge.
  runtime: "nodejs",
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
