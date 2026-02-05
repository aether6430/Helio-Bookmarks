import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

const mimeByExt: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const getMimeType = (path: string) => {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  const ext = path.slice(dot).toLowerCase();
  return mimeByExt[ext] ?? "application/octet-stream";
};

const distDir = resolve(process.cwd(), "dist");
const outFile = resolve(process.cwd(), "dist.bundle.json");

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
};

const normalizeRelPath = (absPath: string) => {
  const rel = relative(distDir, absPath);
  return rel.split(sep).join("/");
};

const run = async () => {
  const distStat = await stat(distDir).catch(() => null);
  if (!distStat || !distStat.isDirectory()) {
    throw new Error("dist directory not found. Run `bun run build` first.");
  }

  const absFiles = await walk(distDir);
  const files: Record<string, { type: string; data: string }> = {};

  for (const absPath of absFiles) {
    const relPath = normalizeRelPath(absPath);
    const data = await readFile(absPath);
    files[relPath] = {
      type: getMimeType(relPath),
      data: Buffer.from(data).toString("base64"),
    };
  }

  const payload = { version: 1, files };
  await writeFile(outFile, JSON.stringify(payload));
  console.log(`Wrote ${Object.keys(files).length} files to ${outFile}`);
};

await run();
