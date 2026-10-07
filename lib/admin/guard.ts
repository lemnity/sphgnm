// Проверка входа для роутов и страниц админки. middleware тоже закрывает эти пути,
// но каждый обработчик проверяет сессию сам: защита не должна зависеть от matcher.
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, resolveSessionSecret, verifySessionToken } from "./session.ts";
import { StorageError } from "./storage.ts";

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

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/** null — можно продолжать, иначе готовый ответ 401. */
export function requireAdmin(request: NextRequest): NextResponse | null {
  return isAdminRequest(request) ? null : jsonError(401, "Нужно войти в админку");
}

/** Ошибки хранилища — их статус и текст; прочее — 500 без подробностей наружу. */
export function handleError(error: unknown): NextResponse {
  if (error instanceof StorageError) return jsonError(error.status, error.message);
  console.error("[admin]", error);
  return jsonError(500, "Внутренняя ошибка сервера");
}
