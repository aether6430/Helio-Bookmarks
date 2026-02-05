export type Bookmark = {
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

export type BookmarkInput = {
  url: string;
  title: string;
  description?: string;
  tags?: string[];
  notes?: string;
  siteName?: string;
  image?: string;
  language?: string;
};

export type BookmarkUpdate = Partial<BookmarkInput>;

export type BookmarkStore = {
  version: 1;
  bookmarks: Bookmark[];
};
