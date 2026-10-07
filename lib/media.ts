// Путь к файлу из public → URL с учётом подпапки GitHub Pages (/sphgnm).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  return `${BASE_PATH}/${path.replace(/^\/+/, "")}`;
}
