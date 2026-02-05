type Bookmark = {
  id: string;
  url: string;
  title: string;
  description?: string;
  tags: string[];
  notes?: string;
  siteName?: string;
  image?: string;
  language?: string;
  createdAt: string;
  updatedAt: string;
};

const listEl = document.querySelector<HTMLDivElement>("#bookmark-list");
const emptyEl = document.querySelector<HTMLDivElement>("#empty-state");
const refreshBtn = document.querySelector<HTMLButtonElement>("#refresh");
const searchInput = document.querySelector<HTMLInputElement>("#search");
const clearSearchBtn = document.querySelector<HTMLButtonElement>("#clear-search");
const form = document.querySelector<HTMLFormElement>("#bookmark-form");
const formTitle = document.querySelector<HTMLHeadingElement>("#form-title");
const cancelEditBtn = document.querySelector<HTMLButtonElement>("#cancel-edit");
const formStatus = document.querySelector<HTMLParagraphElement>("#form-status");

if (!listEl || !emptyEl || !refreshBtn || !searchInput || !clearSearchBtn || !form || !formTitle || !cancelEditBtn || !formStatus) {
  throw new Error("Missing required DOM elements");
}

const fields = {
  title: form.querySelector<HTMLInputElement>("#title")!,
  url: form.querySelector<HTMLInputElement>("#url")!,
  description: form.querySelector<HTMLTextAreaElement>("#description")!,
  tags: form.querySelector<HTMLInputElement>("#tags")!,
  siteName: form.querySelector<HTMLInputElement>("#siteName")!,
  notes: form.querySelector<HTMLTextAreaElement>("#notes")!,
  image: form.querySelector<HTMLInputElement>("#image")!,
  language: form.querySelector<HTMLInputElement>("#language")!,
};

let bookmarks: Bookmark[] = [];
let editingId: string | null = null;
let pendingMetaUrl = "";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const setStatus = (message: string, tone: "muted" | "error" = "muted") => {
  formStatus.textContent = message;
  formStatus.className = tone === "error" ? "text-sm text-red-600" : "text-sm text-ink-600";
};

const resetForm = () => {
  form.reset();
  editingId = null;
  formTitle.textContent = "Add a bookmark";
  cancelEditBtn.classList.add("hidden");
  pendingMetaUrl = "";
  setStatus("");
};

const populateForm = (bookmark: Bookmark) => {
  fields.title.value = bookmark.title;
fields.url.value = bookmark.url;
  fields.description.value = bookmark.description ?? "";
  fields.tags.value = bookmark.tags.join(", ");
  fields.siteName.value = bookmark.siteName ?? "";
  fields.notes.value = bookmark.notes ?? "";
  fields.image.value = bookmark.image ?? "";
fields.language.value = bookmark.language ?? "";
editingId = bookmark.id;
formTitle.textContent = "Edit bookmark";
cancelEditBtn.classList.remove("hidden");
};

const render = (data: Bookmark[]) => {
  listEl.innerHTML = "";
  if (!data.length) {
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  data.forEach((bookmark) => {
    const card = document.createElement("article");
    card.className = "rounded-2xl border border-ink-200 bg-transparent p-4 shadow-soft";

    const tags = bookmark.tags.length
      ? `<div class=\"mt-2 flex flex-wrap gap-2\">${bookmark.tags
          .map(
            (tag) =>
              `<span class=\"rounded-full bg-ink-50 px-3 py-1 text-[11px] font-semibold text-ink-700\">${tag}</span>`
          )
          .join("")}</div>`
      : "";

    const image = bookmark.image
      ? `<div class=\"mt-3 overflow-hidden rounded-xl border border-ink-200\"><img src=\"${bookmark.image}\" alt=\"${bookmark.title}\" class=\"h-28 w-full object-cover\" /></div>`
      : "";

    card.innerHTML = `
      <div class=\"flex flex-col gap-3\">
        <div class=\"flex items-start justify-between gap-3\">
          <div>
            <p class=\"text-[11px] uppercase tracking-[0.2em] text-moss-400\">${bookmark.siteName ?? "Saved"}</p>
            <h3 class=\"font-display text-lg font-semibold text-ink-900\">${bookmark.title}</h3>
            <a class=\"mt-1 inline-flex items-center gap-2 text-xs font-semibold text-moss-600 hover:text-moss-400\" href=\"${bookmark.url}\" target=\"_blank\" rel=\"noreferrer\">
              Visit link
            </a>
          </div>
          <div class=\"text-right text-[11px] text-ink-500\">
            <div>Added ${formatDate(bookmark.createdAt)}</div>
            <div>Updated ${formatDate(bookmark.updatedAt)}</div>
          </div>
        </div>
        ${bookmark.description ? `<p class=\"text-xs text-ink-700\">${bookmark.description}</p>` : ""}
        ${bookmark.notes ? `<p class=\"rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-700\">${bookmark.notes}</p>` : ""}
        ${tags}
        ${image}
        <div class=\"flex flex-wrap gap-2\">
          <button data-action=\"edit\" data-id=\"${bookmark.id}\" class=\"rounded-full border border-ink-200 px-3 py-1.5 text-[11px] font-semibold text-ink-700\">Edit</button>
          <button data-action=\"delete\" data-id=\"${bookmark.id}\" class=\"rounded-full border border-ink-200 px-3 py-1.5 text-[11px] font-semibold text-ink-700\">Delete</button>
        </div>
      </div>
    `;

    listEl.appendChild(card);
  });
};

const loadBookmarks = async () => {
  const response = await fetch("/api/bookmarks");
  if (!response.ok) throw new Error("Failed to load bookmarks");
  bookmarks = (await response.json()) as Bookmark[];
  render(bookmarks);
};

const searchBookmarks = () => {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    render(bookmarks);
    return;
  }
  const filtered = bookmarks.filter((bookmark) => {
    const content = [
      bookmark.title,
      bookmark.url,
      bookmark.description ?? "",
      bookmark.notes ?? "",
      bookmark.siteName ?? "",
      bookmark.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return content.includes(query);
  });
  render(filtered);
};

const submitForm = async (event: Event) => {
  event.preventDefault();
  const payload = {
    title: fields.title.value.trim(),
    url: fields.url.value.trim(),
    description: fields.description.value.trim(),
    tags: fields.tags.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    siteName: fields.siteName.value.trim(),
    notes: fields.notes.value.trim(),
    image: fields.image.value.trim(),
    language: fields.language.value.trim(),
  };

  if (!payload.title || !payload.url) {
    setStatus("Title and URL are required.", "error");
    return;
  }

  const endpoint = editingId ? `/api/bookmarks/${editingId}` : "/api/bookmarks";
  const method = editingId ? "PUT" : "POST";

  const response = await fetch(endpoint, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = (await response.json()) as { error?: string };
    setStatus(error.error ?? "Something went wrong", "error");
    return;
  }

  setStatus(editingId ? "Bookmark updated." : "Bookmark added.");
  resetForm();
  await loadBookmarks();
};

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const hydrateFromMetadata = async (url: string) => {
  if (!url || editingId) return;
  const normalized = normalizeUrl(url);
  pendingMetaUrl = normalized;
  setStatus("Fetching metadata...");
  try {
    const response = await fetch(`/api/metadata?url=${encodeURIComponent(normalized)}`);
    if (!response.ok) {
      const error = (await response.json()) as { error?: string };
      setStatus(error.error ?? "Could not fetch metadata.", "error");
      return;
    }
    const meta = (await response.json()) as {
      title?: string;
      description?: string;
      siteName?: string;
      image?: string;
      language?: string;
    };
    if (pendingMetaUrl !== normalized) return;
    if (meta.title && !fields.title.value.trim()) fields.title.value = meta.title;
    if (meta.description && !fields.description.value.trim())
      fields.description.value = meta.description;
    if (meta.siteName && !fields.siteName.value.trim()) fields.siteName.value = meta.siteName;
    if (meta.image && !fields.image.value.trim()) fields.image.value = meta.image;
    if (meta.language && !fields.language.value.trim()) fields.language.value = meta.language;
    setStatus(meta.title ? "Metadata loaded." : "No metadata found.");
  } catch {
    setStatus("Could not fetch metadata.", "error");
  }
};

listEl.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const action = target.getAttribute("data-action");
  const id = target.getAttribute("data-id");
  if (!action || !id) return;

  if (action === "edit") {
    const bookmark = bookmarks.find((item) => item.id === id);
    if (bookmark) {
      populateForm(bookmark);
      setStatus("Editing mode. Update fields and save.");
    }
  }

  if (action === "delete") {
    const confirmed = window.confirm("Delete this bookmark?");
    if (!confirmed) return;
    const response = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setStatus("Failed to delete bookmark.", "error");
      return;
    }
    setStatus("Bookmark deleted.");
    await loadBookmarks();
  }
});

refreshBtn.addEventListener("click", () => {
  loadBookmarks().catch(() => setStatus("Failed to refresh.", "error"));
});

searchInput.addEventListener("input", searchBookmarks);
clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  render(bookmarks);
});

cancelEditBtn.addEventListener("click", () => {
  resetForm();
});

form.addEventListener("submit", submitForm);
let metadataTimer: number | undefined;
fields.url.addEventListener("input", () => {
  const url = fields.url.value.trim();
  if (metadataTimer) window.clearTimeout(metadataTimer);
  if (!url) return;
  metadataTimer = window.setTimeout(() => {
    hydrateFromMetadata(url).catch(() => setStatus("Failed to load metadata.", "error"));
  }, 600);
});

loadBookmarks().catch(() => setStatus("Failed to load bookmarks.", "error"));
