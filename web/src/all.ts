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

const listEl = document.querySelector<HTMLDivElement>("#all-bookmark-list");
const emptyEl = document.querySelector<HTMLDivElement>("#all-empty-state");
const refreshBtn = document.querySelector<HTMLButtonElement>("#refresh-all");
const prevBtn = document.querySelector<HTMLButtonElement>("#prev-page");
const nextBtn = document.querySelector<HTMLButtonElement>("#next-page");
const pageInfoEl = document.querySelector<HTMLParagraphElement>("#page-info");
const pageRangeEl = document.querySelector<HTMLParagraphElement>("#page-range");

if (!listEl || !emptyEl || !refreshBtn || !prevBtn || !nextBtn || !pageInfoEl || !pageRangeEl) {
  throw new Error("Missing required DOM elements");
}

const PAGE_SIZE = 12;
let bookmarks: Bookmark[] = [];
let currentPage = 1;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const renderPage = () => {
  const total = bookmarks.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);

  listEl.innerHTML = "";

  if (!total) {
    emptyEl.classList.remove("hidden");
    pageRangeEl.textContent = "No bookmarks yet.";
    pageInfoEl.textContent = "";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  emptyEl.classList.add("hidden");

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, total);
  const pageItems = bookmarks.slice(startIndex, endIndex);

  pageItems.forEach((bookmark) => {
    const card = document.createElement("article");
    card.className = "bookmark-card w-full max-w-sm rounded-2xl border border-ink-200 bg-transparent p-4 shadow-soft";

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
        <div class=\"bookmark-card-details flex flex-col gap-3\">
          ${bookmark.description ? `<p class=\"text-xs text-ink-700\">${bookmark.description}</p>` : ""}
          ${bookmark.notes ? `<p class=\"rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-700\">${bookmark.notes}</p>` : ""}
          ${tags}
          ${image}
        </div>
      </div>
    `;

    listEl.appendChild(card);
  });

  pageRangeEl.textContent = `Showing ${startIndex + 1}-${endIndex} of ${total}`;
  pageInfoEl.textContent = `Page ${currentPage} of ${totalPages}`;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;
};

const loadBookmarks = async () => {
  try {
    const response = await fetch("/api/bookmarks");
    if (!response.ok) throw new Error("Failed to load bookmarks");
    bookmarks = (await response.json()) as Bookmark[];
    renderPage();
  } catch {
    pageRangeEl.textContent = "Failed to load bookmarks.";
    pageInfoEl.textContent = "";
  }
};

prevBtn.addEventListener("click", () => {
  currentPage -= 1;
  renderPage();
});

nextBtn.addEventListener("click", () => {
  currentPage += 1;
  renderPage();
});

refreshBtn.addEventListener("click", () => {
  loadBookmarks().catch(() => {
    pageRangeEl.textContent = "Failed to load bookmarks.";
  });
});

loadBookmarks().catch(() => {
  pageRangeEl.textContent = "Failed to load bookmarks.";
});
