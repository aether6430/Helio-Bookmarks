import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Bookmark, BookmarkInput, BookmarkStore, BookmarkUpdate } from "./types";

const DATA_PATH = resolve(process.cwd(), "data", "bookmarks.json");

const emptyStore: BookmarkStore = {
  version: 1,
  bookmarks: [],
};

const ensureStoreFile = async () => {
  await mkdir(dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(emptyStore, null, 2), "utf-8");
  return structuredClone(emptyStore);
};

const parseStore = (raw: string): BookmarkStore => {
  const parsed = JSON.parse(raw) as BookmarkStore;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.bookmarks)) {
    return structuredClone(emptyStore);
  }
  return parsed;
};

export const readStore = async (): Promise<BookmarkStore> => {
  try {
    const raw = await readFile(DATA_PATH, "utf-8");
    return parseStore(raw);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return ensureStoreFile();
    }
    throw error;
  }
};

export const writeStore = async (store: BookmarkStore) => {
  await mkdir(dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(store, null, 2), "utf-8");
};

export const listBookmarks = async () => {
  const store = await readStore();
  return store.bookmarks;
};

export const getBookmark = async (id: string) => {
  const store = await readStore();
  return store.bookmarks.find((bookmark) => bookmark.id === id) ?? null;
};

const normalizeTags = (tags?: string[]) => {
  if (!tags) return [];
  return tags
    .flatMap((tag) => tag.split(","))
    .map((tag) => tag.trim())
    .filter(Boolean);
};

export const createBookmark = async (input: BookmarkInput) => {
  const store = await readStore();
  const now = new Date().toISOString();
  const bookmark: Bookmark = {
    id: crypto.randomUUID(),
    url: input.url.trim(),
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    tags: normalizeTags(input.tags),
    notes: input.notes?.trim() || undefined,
    siteName: input.siteName?.trim() || undefined,
    image: input.image?.trim() || undefined,
    language: input.language?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  store.bookmarks.unshift(bookmark);
  await writeStore(store);
  return bookmark;
};

export const updateBookmark = async (id: string, update: BookmarkUpdate) => {
  const store = await readStore();
  const index = store.bookmarks.findIndex((bookmark) => bookmark.id === id);
  if (index === -1) {
    return null;
  }

  const existing = store.bookmarks[index];
  const nextTags = update.tags ? normalizeTags(update.tags) : existing.tags;
  const applyOptional = (value: string | undefined, fallback: string | undefined) => {
    if (value === undefined) return fallback;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };
  const updated: Bookmark = {
    ...existing,
    url: update.url !== undefined ? update.url.trim() : existing.url,
    title: update.title !== undefined ? update.title.trim() : existing.title,
    description: applyOptional(update.description, existing.description),
    notes: applyOptional(update.notes, existing.notes),
    siteName: applyOptional(update.siteName, existing.siteName),
    image: applyOptional(update.image, existing.image),
    language: applyOptional(update.language, existing.language),
    tags: nextTags,
    updatedAt: new Date().toISOString(),
  };

  store.bookmarks[index] = updated;
  await writeStore(store);
  return updated;
};

export const deleteBookmark = async (id: string) => {
  const store = await readStore();
  const next = store.bookmarks.filter((bookmark) => bookmark.id !== id);
  if (next.length === store.bookmarks.length) {
    return false;
  }
  store.bookmarks = next;
  await writeStore(store);
  return true;
};

export const searchBookmarks = async (query: string) => {
  const store = await readStore();
  const normalized = query.trim().toLowerCase();
  if (!normalized) return store.bookmarks;
  return store.bookmarks.filter((bookmark) => {
    const haystack = [
      bookmark.title,
      bookmark.url,
      bookmark.description ?? "",
      bookmark.notes ?? "",
      bookmark.siteName ?? "",
      bookmark.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
};
