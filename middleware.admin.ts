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

// За nginx request.url указывает на 127.0.0.1:3000 — адрес для переадресации
// собираем из заголовков прокси (Next слушает только localhost, снаружи их не подменить).
function redirectTo(request: NextRequest, path: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const base = host ? `${proto}://${host}` : request.url;
  return NextResponse.redirect(new URL(path, base));
}

/**
 * CSP страниц кабинета. Скрипты и стили Next не ограничиваем (dev и prod грузят их по-разному),
 * закрываем то, что важно для почты: фреймы — только свои и about:srcdoc (письмо в песочнице),
 * так что переход из фрейма письма на чужой сайт браузер не выполнит; плагины, <base>,
 * встраивание кабинета в чужие страницы и отправка форм наружу запрещены.
 */
const ADMIN_CSP = "frame-src 'self' about:; child-src 'self' about:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

function page() {
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", ADMIN_CSP);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/admin/login") return NextResponse.next();

  const authed = isAdminRequest(request);
  if (pathname === "/admin/login") {
    return authed ? redirectTo(request, "/admin") : page();
  }
  if (authed) return pathname.startsWith("/api/") ? NextResponse.next() : page();

  if (pathname.startsWith("/api/")) {
    const lang = pickLang({
      header: request.headers.get(LANG_HEADER),
      cookie: request.cookies.get(LANG_COOKIE)?.value,
      acceptLanguage: request.headers.get("accept-language"),
    });
    return NextResponse.json({ error: translate(lang, "api.unauthorized"), code: codeOf("api.unauthorized") }, { status: 401 });
  }
  return redirectTo(request, `/admin/login?next=${encodeURIComponent(pathname)}`);
}

export const config = {
  // node:crypto для проверки подписи — нужен Node-рантайм, а не Edge.
  runtime: "nodejs",
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
