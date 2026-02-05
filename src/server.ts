import {
  createBookmark,
  deleteBookmark,
  getBookmark,
  listBookmarks,
  updateBookmark,
} from "./lib/storage";
import type { BookmarkInput, BookmarkUpdate } from "./lib/types";
import { fetchMetadata } from "./lib/metadata";
import { resolve } from "node:path";
import { getEmbeddedFile } from "./lib/embedded";

export type ServerOptions = {
  port?: number;
  staticDir?: string;
  embedded?: boolean;
};

const normalizeUrl = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });

const parseBody = async <T>(req: Request): Promise<T | null> => {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
};

const requireFields = (payload: BookmarkInput | BookmarkUpdate) => {
  if ("url" in payload && payload.url !== undefined && !payload.url.trim()) {
    return "URL is required";
  }
  if ("title" in payload && payload.title !== undefined && !payload.title.trim()) {
    return "Title is required";
  }
  return null;
};

const getIdFromPath = (pathname: string) => {
  const match = pathname.match(/^\/api\/bookmarks\/([^/]+)$/);
  return match?.[1] ?? null;
};

const serveStatic = async (pathname: string, staticDir: string) => {
  const decoded = decodeURIComponent(pathname);
  const safePath = decoded.split("?")[0];
  const resolved = resolve(staticDir, `.${safePath}`);
  if (!resolved.startsWith(staticDir)) return null;
  const file = Bun.file(resolved);
  if (await file.exists()) {
    return new Response(file);
  }
  const index = Bun.file(resolve(staticDir, "index.html"));
  if (await index.exists()) {
    return new Response(index);
  }
  return null;
};

const serveEmbedded = async (pathname: string) => {
  const entry = await getEmbeddedFile(pathname);
  if (!entry) return null;
  return new Response(entry.file, {
    headers: {
      "content-type": entry.type,
    },
  });
};

export const startServer = (options: ServerOptions = {}) => {
  const port = options.port ?? Number(process.env.BM_PORT ?? 5174);
  const staticDir = options.staticDir;
  const useEmbedded = options.embedded ?? false;

  Bun.serve({
    port,
    fetch: async (req) => {
      const url = new URL(req.url);
      const { pathname } = url;
      const method = req.method.toUpperCase();

      if (method === "OPTIONS") {
        return json({ ok: true });
      }

      if (pathname === "/api/bookmarks" && method === "GET") {
        const bookmarks = await listBookmarks();
        return json(bookmarks);
      }

      if (pathname === "/api/metadata" && method === "GET") {
        const target = url.searchParams.get("url");
        if (!target) return json({ error: "url is required" }, 400);
        const normalized = normalizeUrl(target);
        if (!normalized) return json({ error: "url is required" }, 400);
        try {
          new URL(normalized);
        } catch {
          return json({ error: "invalid url" }, 400);
        }
        const meta = await fetchMetadata(normalized);
        return json(meta);
      }

      if (pathname === "/api/bookmarks" && method === "POST") {
        const payload = await parseBody<BookmarkInput>(req);
        if (!payload) return json({ error: "Invalid JSON" }, 400);
        if (!payload.url || !payload.title) {
          return json({ error: "url and title are required" }, 400);
        }
        const validation = requireFields(payload);
        if (validation) return json({ error: validation }, 400);
        const bookmark = await createBookmark(payload);
        return json(bookmark, 201);
      }

      const id = getIdFromPath(pathname);
      if (id && method === "GET") {
        const bookmark = await getBookmark(id);
        if (!bookmark) return json({ error: "Not found" }, 404);
        return json(bookmark);
      }

      if (id && method === "PUT") {
        const payload = await parseBody<BookmarkUpdate>(req);
        if (!payload) return json({ error: "Invalid JSON" }, 400);
        const validation = requireFields(payload);
        if (validation) return json({ error: validation }, 400);
        const updated = await updateBookmark(id, payload);
        if (!updated) return json({ error: "Not found" }, 404);
        return json(updated);
      }

      if (id && method === "DELETE") {
        const ok = await deleteBookmark(id);
        if (!ok) return json({ error: "Not found" }, 404);
        return json({ ok: true });
      }

      if (pathname === "/api/health") {
        return json({ ok: true, port });
      }

      if (staticDir && method === "GET") {
        const response = await serveStatic(pathname, staticDir);
        if (response) return response;
      }

      if (useEmbedded && method === "GET") {
        const response = await serveEmbedded(pathname);
        if (response) return response;
      }

      return json({ error: "Not found" }, 404);
    },
  });

  const label = staticDir || useEmbedded ? "GUI" : "API";
  console.log(`${label} server running on http://localhost:${port}`);
};

if (import.meta.main) {
  startServer();
}
