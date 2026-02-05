export type BookmarkMetadata = {
  title?: string;
  description?: string;
  siteName?: string;
  image?: string;
  language?: string;
};

const decodeEntities = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const extractTitle = (html: string) => {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? decodeEntities(match[1]) : undefined;
};

const extractHtmlLang = (html: string) => {
  const match = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  return match ? decodeEntities(match[1]) : undefined;
};

const extractMetaTags = (html: string) => {
  const tags = html.match(/<meta\s+[^>]*>/gi) ?? [];
  const results: Record<string, string> = {};

  for (const tag of tags) {
    const attrs: Record<string, string> = {};
    const attrMatches = tag.matchAll(/([a-zA-Z:-]+)=["']([^"']*)["']/g);
    for (const match of attrMatches) {
      attrs[match[1].toLowerCase()] = decodeEntities(match[2]);
    }
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (key && attrs.content) {
      results[key] = attrs.content;
    }
  }

  return results;
};

export const fetchMetadata = async (url: string): Promise<BookmarkMetadata> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) helio/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (contentType && !contentType.includes("text/html")) {
      return {};
    }
    const html = await response.text();
    const meta = extractMetaTags(html);
    const title = meta["og:title"] || meta["twitter:title"] || extractTitle(html);
    const description =
      meta["og:description"] || meta["twitter:description"] || meta["description"];
    const siteName = meta["og:site_name"] || meta["application-name"];
    const image = meta["og:image"] || meta["twitter:image"];
    const language = extractHtmlLang(html);

    return {
      title,
      description,
      siteName,
      image,
      language,
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
};
