import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, render, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import {
  createBookmark,
  deleteBookmark,
  listBookmarks,
  updateBookmark,
} from "./lib/storage";
import { fetchMetadata } from "./lib/metadata";
import type { Bookmark } from "./lib/types";

const fieldOrder = [
  "url",
  "title",
  "description",
  "tags",
  "notes",
  "siteName",
  "image",
  "language",
] as const;

type FieldKey = (typeof fieldOrder)[number];

type Draft = Record<FieldKey, string>;

type Mode =
  | { kind: "normal" }
  | { kind: "add"; step: number; draft: Draft }
  | { kind: "edit"; step: number; draft: Draft; existing: Bookmark }
  | { kind: "confirmDelete"; target: Bookmark };

type ActionKey = "add" | "edit" | "delete" | "refresh" | "search" | "clear" | "quit";

type ActionItem = {
  label: string;
  value: ActionKey;
};

const emptyDraft = (): Draft => ({
  title: "",
  url: "",
  description: "",
  tags: "",
  notes: "",
  siteName: "",
  image: "",
  language: "",
});

const labelForField = (field: FieldKey) => {
  switch (field) {
    case "siteName":
      return "site name";
    case "description":
      return "description";
    case "image":
      return "image url";
    default:
      return field;
  }
};

const App = () => {
  const { exit } = useApp();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState("Ready.");
  const [mode, setMode] = useState<Mode>({ kind: "normal" });
  const [inputValue, setInputValue] = useState("");
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);

  const refresh = async () => {
    const data = await listBookmarks();
    setBookmarks(data);
  };

  useEffect(() => {
    refresh().catch(() => setStatus("Failed to load bookmarks."));
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return bookmarks;
    const q = searchQuery.trim().toLowerCase();
    return bookmarks.filter((bookmark) => {
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
      return haystack.includes(q);
    });
  }, [bookmarks, searchQuery]);

  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  const selected = filtered[selectedIndex] ?? null;

  const resetToNormal = () => {
    setMode({ kind: "normal" });
    setInputValue("");
  };

  const startAdd = () => {
    setMode({ kind: "add", step: 0, draft: emptyDraft() });
    setInputValue("");
    setStatus("Adding a new bookmark.");
  };

  const startEdit = (bookmark: Bookmark) => {
    const draft = emptyDraft();
    draft.title = bookmark.title;
    draft.url = bookmark.url;
    draft.description = bookmark.description ?? "";
    draft.tags = bookmark.tags.join(", ");
    draft.notes = bookmark.notes ?? "";
    draft.siteName = bookmark.siteName ?? "";
    draft.image = bookmark.image ?? "";
    draft.language = bookmark.language ?? "";

    setMode({ kind: "edit", step: 0, draft, existing: bookmark });
    setInputValue(draft[fieldOrder[0]]);
    setStatus("Editing. Press Enter to keep existing values.");
  };

  const startDelete = (bookmark: Bookmark) => {
    setMode({ kind: "confirmDelete", target: bookmark });
    setInputValue("");
    setStatus(`Type YES to delete ${bookmark.title}.`);
  };

  const applyDraft = async (draft: Draft, existing?: Bookmark) => {
    if (existing) {
      const updated = await updateBookmark(existing.id, {
        title: draft.title || existing.title,
        url: draft.url || existing.url,
        description: draft.description || undefined,
        tags: draft.tags ? draft.tags.split(",") : existing.tags,
        notes: draft.notes || undefined,
        siteName: draft.siteName || undefined,
        image: draft.image || undefined,
        language: draft.language || undefined,
      });
      if (!updated) {
        setStatus("Update failed.");
      } else {
        setStatus("Bookmark updated.");
      }
    } else {
      if (!draft.title.trim() || !draft.url.trim()) {
        setStatus("Title and URL are required.");
        return;
      }
      await createBookmark({
        title: draft.title,
        url: draft.url,
        description: draft.description || undefined,
        tags: draft.tags ? draft.tags.split(",") : undefined,
        notes: draft.notes || undefined,
        siteName: draft.siteName || undefined,
        image: draft.image || undefined,
        language: draft.language || undefined,
      });
      setStatus("Bookmark added.");
    }
    await refresh();
  };

  const handleSubmit = async (value: string) => {
    if (mode.kind === "add" || mode.kind === "edit") {
      const { step, draft } = mode;
      const field = fieldOrder[step];
      const nextDraft = { ...draft };
      if (mode.kind === "edit" && value.trim() === "") {
        nextDraft[field] = draft[field];
      } else {
        nextDraft[field] = value.trim();
      }
      if (mode.kind === "add" && field === "url" && nextDraft.url) {
        setIsFetchingMeta(true);
        setStatus("Fetching metadata...");
        const meta = await fetchMetadata(nextDraft.url);
        if (meta.title && !nextDraft.title) nextDraft.title = meta.title;
        if (meta.description && !nextDraft.description) nextDraft.description = meta.description;
        if (meta.siteName && !nextDraft.siteName) nextDraft.siteName = meta.siteName;
        if (meta.image && !nextDraft.image) nextDraft.image = meta.image;
        if (meta.language && !nextDraft.language) nextDraft.language = meta.language;
        setIsFetchingMeta(false);
        setStatus(meta.title ? "Metadata loaded." : "No metadata found.");
      }
      const nextStep = step + 1;
      if (nextStep >= fieldOrder.length) {
        await applyDraft(nextDraft, mode.kind === "edit" ? mode.existing : undefined);
        resetToNormal();
      } else {
        setMode({ ...mode, step: nextStep, draft: nextDraft });
        const nextField = fieldOrder[nextStep];
        setInputValue(nextDraft[nextField]);
      }
      return;
    }

    if (mode.kind === "confirmDelete") {
      if (value.trim().toUpperCase() === "YES") {
        const ok = await deleteBookmark(mode.target.id);
        setStatus(ok ? "Bookmark deleted." : "Delete failed.");
        await refresh();
      } else {
        setStatus("Delete cancelled.");
      }
      resetToNormal();
      return;
    }
  };

  const actions: ActionItem[] = [
    { label: "Add", value: "add" },
    { label: "Edit", value: "edit" },
    { label: "Delete", value: "delete" },
    { label: "Refresh", value: "refresh" },
    { label: "Search", value: "search" },
    { label: "Clear search", value: "clear" },
    { label: "Quit", value: "quit" },
  ];

  const onAction = async (item: ActionItem) => {
    switch (item.value) {
      case "add":
        startAdd();
        return;
      case "edit":
        if (!selected) {
          setStatus("Select a bookmark first.");
          return;
        }
        startEdit(selected);
        return;
      case "delete":
        if (!selected) {
          setStatus("Select a bookmark first.");
          return;
        }
        startDelete(selected);
        return;
      case "refresh":
        await refresh();
        setStatus("Refreshed.");
        return;
      case "search":
        setInputValue(searchQuery);
        setMode({ kind: "normal" });
        setStatus("Type to search and hit Enter.");
        return;
      case "clear":
        setSearchQuery("");
        setStatus("Search cleared.");
        return;
      case "quit":
        exit();
    }
  };

  useInput((_, key) => {
    if (mode.kind !== "normal") return;
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(filtered.length - 1, prev + 1));
    }
  });

  const prompt = (() => {
    if (mode.kind === "add" || mode.kind === "edit") {
      const field = fieldOrder[mode.step];
      const base = `Enter ${labelForField(field)}`;
      if (mode.kind === "edit") {
        return `${base} (enter to keep)`;
      }
      return base;
    }
    if (mode.kind === "confirmDelete") {
      return `Type YES to delete ${mode.target.title}`;
    }
    return "Search or enter value";
  })();

  const handleSearchSubmit = (value: string) => {
    const trimmed = value.trim();
    setSearchQuery(trimmed);
    setStatus(trimmed ? `Searching: ${trimmed}` : "Search cleared.");
    setInputValue("");
  };

  return (
    <Box flexDirection="column" gap={1} padding={1}>
      <Box borderStyle="round" borderColor="cyan" padding={1} flexDirection="column">
        <Text>Bookmark TUI</Text>
        <Text color="gray">Data: data/bookmarks.json</Text>
      </Box>

      <Box flexDirection="row" gap={1}>
        <Box flexGrow={1} borderStyle="round" borderColor="gray" padding={1} flexDirection="column">
          <Text>Bookmarks ({filtered.length})</Text>
          {filtered.length === 0 ? (
            <Text color="gray">No bookmarks yet.</Text>
          ) : (
            filtered.map((bookmark, index) => (
              <Text key={bookmark.id} color={index === selectedIndex ? "cyan" : undefined}>
                {index === selectedIndex ? "▸" : " "} {bookmark.title} ({bookmark.id})
              </Text>
            ))
          )}
        </Box>

        <Box width={36} borderStyle="round" borderColor="gray" padding={1} flexDirection="column" gap={1}>
          <Text>Status</Text>
          <Text color="yellow">{status}</Text>
          {isFetchingMeta ? <Text color="cyan">Loading metadata…</Text> : null}
          <Text>Search: {searchQuery || "—"}</Text>
          <Text>Actions</Text>
          <SelectInput items={actions} onSelect={onAction} />
        </Box>
      </Box>

      <Box borderStyle="round" borderColor="cyan" padding={1}>
        {mode.kind === "normal" ? (
          <Box flexDirection="row">
            <Text color="cyan">Search: </Text>
            <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleSearchSubmit} />
          </Box>
        ) : (
          <Box flexDirection="row">
            <Text color="cyan">{prompt}: </Text>
            <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleSubmit} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

render(<App />);
