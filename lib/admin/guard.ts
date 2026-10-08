// Проверка входа для роутов и страниц админки. middleware тоже закрывает эти пути,
// но каждый обработчик проверяет сессию сам: защита не должна зависеть от matcher.
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LANG, LANG_COOKIE, LANG_HEADER, codeOf, isAdminLang, pickLang, translate, type AdminLang, type ApiKey, type Params } from "./i18n.ts";
import { SESSION_COOKIE, resolveSessionSecret, verifySessionToken } from "./session.ts";
import { ConflictError, StorageError } from "./storage.ts";

/** Корень проекта: content/ и public/ лежат рядом с package.json. */
export const PROJECT_ROOT = process.cwd();

export function isAdminToken(token: string | undefined): boolean {
  const result = resolveSessionSecret();
  return "secret" in result && verifySessionToken(token, result.secret);
}

export function isAdminRequest(request: NextRequest): boolean {
  return isAdminToken(request.cookies.get(SESSION_COOKIE)?.value);
}

/** Для серверных компонентов админки. */
export async function hasAdminSession(): Promise<boolean> {
  return isAdminToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Язык ответа API: заголовок кабинета → cookie → Accept-Language → ru. */
export function requestLang(request: NextRequest): AdminLang {
  return pickLang({
    header: request.headers.get(LANG_HEADER),
    cookie: request.cookies.get(LANG_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
}

/** Язык страниц кабинета: только выбор из cookie, по умолчанию ru. */
export async function pageLang(): Promise<AdminLang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isAdminLang(value) ? value : DEFAULT_LANG;
}

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Ошибка по ключу словаря: текст на языке запроса и стабильный code для клиента. */
export function apiError(lang: AdminLang, status: number, key: ApiKey, params: Params = {}, extra: Record<string, unknown> = {}) {
  return jsonError(status, translate(lang, key, params), { code: codeOf(key), ...extra });
}

/** null — можно продолжать, иначе готовый ответ 401. */
export function requireAdmin(request: NextRequest): NextResponse | null {
  return isAdminRequest(request) ? null : apiError(requestLang(request), 401, "api.unauthorized");
}

/** Ошибки хранилища — их статус и текст; прочее — 500 без подробностей наружу. */
export function handleError(error: unknown, lang: AdminLang = DEFAULT_LANG): NextResponse {
  if (error instanceof ConflictError) return jsonError(409, error.messageIn(lang), { code: error.code, conflict: error.conflict });
  if (error instanceof StorageError) return jsonError(error.status, error.messageIn(lang), { code: error.code });
  console.error("[admin]", error);
  return apiError(lang, 500, "api.internal");
}
