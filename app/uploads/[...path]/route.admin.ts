// Отдаёт файлы из public/uploads в серверном режиме. next start раздаёт только те файлы
// public, что были на момент запуска, а загруженные из админки появляются позже.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { PROJECT_ROOT } from "@/lib/admin/guard";
import { StorageError, resolveUploadPath, uploadMime } from "@/lib/admin/storage";

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path;
  let file: string;
  try {
    file = resolveUploadPath(PROJECT_ROOT, ["uploads", ...segments].join("/"));
  } catch (error) {
    if (error instanceof StorageError) return new Response("Not found", { status: 404 });
    throw error;
  }

  let size: number;
  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    size = info.size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": uploadMime(file),
    "Accept-Ranges": "bytes",
    // Имена случайные и не переиспользуются — можно кэшировать навсегда.
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });

  // Range нужен видео: Safari без него ролик не проигрывает.
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers });
}
