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

const normalizeHashedName = (name: string) =>
  name.replace(/-[a-f0-9]{8,}(?=\\.)/g, "");

const normalizeEmbeddedCandidates = (name: string) => {
  const normalized = name.replace(/\\/g, "/");
  const cleaned = normalized
    .replace(/^file:\/\//, "")
    .replace(/^\$bunfs\//, "");
  const candidates = new Set<string>();

  candidates.add(cleaned);

  const distIndex = cleaned.lastIndexOf("/dist/");
  if (distIndex !== -1) candidates.add(cleaned.slice(distIndex + 1));
  const distStart = cleaned.indexOf("dist/");
  if (distStart !== -1) candidates.add(cleaned.slice(distStart));

  const assetsIndex = cleaned.lastIndexOf("/assets/");
  if (assetsIndex !== -1) candidates.add(cleaned.slice(assetsIndex + 1));
  const assetsStart = cleaned.indexOf("assets/");
  if (assetsStart !== -1) candidates.add(cleaned.slice(assetsStart));

  const basename = cleaned.split("/").pop();
  if (basename) candidates.add(basename);

  return Array.from(candidates, (value) =>
    value.startsWith("/") ? value.slice(1) : value
  );
};

import { embeddedBundle } from "./embedded-bundle";

type EmbeddedEntry = {
  file: Blob | Uint8Array;
  name: string;
  type: string;
};

let embeddedIndex: Map<string, Blob> | null = null;
let bundleIndex: Map<string, EmbeddedEntry> | null = null;

const getEmbeddedIndex = () => {
  if (!Bun.embeddedFiles || Bun.embeddedFiles.length === 0) return null;
  if (embeddedIndex) return embeddedIndex;

  const index = new Map<string, Blob>();
  for (const file of Bun.embeddedFiles) {
    const keys = normalizeEmbeddedCandidates(file.name);
    for (const key of keys) {
      index.set(key, file);
      index.set(normalizeHashedName(key), file);
    }
  }

  if (process.env.HELIO_DEBUG_EMBEDDED) {
    const preview = Array.from(index.keys()).slice(0, 20).join(", ");
    console.log(`Embedded files indexed (${index.size}): ${preview}`);
  }

  embeddedIndex = index;
  return embeddedIndex;
};

const getBundleIndex = async () => {
  if (bundleIndex) return bundleIndex;
  const payload = embeddedBundle;
  if (!payload?.files) return null;

  const index = new Map<string, EmbeddedEntry>();
  for (const [name, entry] of Object.entries(payload.files)) {
    const data = Buffer.from(entry.data, "base64");
    const type = entry.type || getMimeType(name);
    const embeddedEntry = { file: data, name, type };
    index.set(name, embeddedEntry);
    index.set(normalizeHashedName(name), embeddedEntry);
    const basename = name.split("/").pop();
    if (basename) {
      index.set(basename, embeddedEntry);
      index.set(normalizeHashedName(basename), embeddedEntry);
    }
  }

  bundleIndex = index;
  return bundleIndex;
};

export const getEmbeddedFile = async (
  pathname: string
): Promise<EmbeddedEntry | null> => {
  const embedded = getEmbeddedIndex();
  const normalized = pathname === "/" ? "index.html" : pathname.slice(1);
  const basename = normalized.split("/").pop();
  const candidates = [normalized, `dist/${normalized}`];
  if (basename) candidates.push(basename);

  if (embedded) {
    for (const candidate of candidates) {
      const match =
        embedded.get(candidate) ??
        embedded.get(normalizeHashedName(candidate)) ??
        null;
      if (match) {
        return {
          file: match,
          name: candidate,
          type: match.type || getMimeType(candidate),
        };
      }
    }
  }

  const bundle = await getBundleIndex();
  if (bundle) {
    for (const candidate of candidates) {
      const match =
        bundle.get(candidate) ??
        bundle.get(normalizeHashedName(candidate)) ??
        null;
      if (match) {
        return match;
      }
    }
  }

  return null;
};
