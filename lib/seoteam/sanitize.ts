/**
 * HTML sanitization for blog bodies — server-only.
 *
 * The Tiptap editor emits HTML and pasted Google-Docs/Word content can smuggle
 * arbitrary markup, so we clean it with `sanitize-html` (allowlist) **on save**
 * before it ever touches the DB or `dangerouslySetInnerHTML`. This is the single
 * XSS chokepoint; the keyword linker (lib/seoteam/keyword-links.ts) runs only on
 * already-sanitized output and never reintroduces unsafe markup.
 */
import "server-only";
import sanitizeHtml from "sanitize-html";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "h1",
    "h2",
    "h3",
    "h4",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "hr",
    "code",
    "pre",
    "figure",
    "figcaption",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  // Drop the entire contents of these (default also covers script/style).
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const isExternal = /^https?:\/\//i.test(href);
      return {
        tagName: "a",
        attribs: isExternal
          ? { ...attribs, target: "_blank", rel: "noopener" }
          : attribs,
      };
    },
  },
};

/** Clean untrusted/rich-editor HTML down to a safe public-render allowlist. */
export function sanitizeBlogHtml(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS).trim();
}
