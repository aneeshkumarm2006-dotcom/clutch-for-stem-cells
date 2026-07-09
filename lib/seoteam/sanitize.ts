/**
 * HTML sanitization for blog bodies — server-only.
 *
 * The Tiptap editor emits HTML and pasted Google-Docs/Word content can smuggle
 * arbitrary markup, so we clean it with `sanitize-html` (allowlist) **on save**
 * before it ever touches the DB or `dangerouslySetInnerHTML`. This is the single
 * XSS chokepoint; the keyword linker (lib/seoteam/keyword-links.ts) runs only on
 * already-sanitized output and never reintroduces unsafe markup.
 *
 * The /seoteam authors are trusted, authenticated staff who hand-write article
 * markup (HTML source view) and expect their own styling to render verbatim. So
 * the allowlist is deliberately generous about *presentation*: structural tags,
 * tables, `class`/`id`/`style` attributes, and inline `<style>` blocks all pass
 * through untouched (see `_sh_test` verification — custom properties, grid, and
 * `var()` survive intact). What stays blocked is anything that can execute:
 *   • <script>, <iframe>, <object>, <embed>, <form>, <input> — not in allowedTags.
 *   • on* event handlers — not in allowedAttributes, so they're dropped.
 *   • javascript:/data: URLs — allowedSchemes restricts href/src to http(s)/mailto/tel.
 * Trade-off worth knowing: a `<style>` block can `@import` an external stylesheet
 * or use `position:fixed` overlays. That's acceptable for trusted internal authors
 * but should be revisited if body authoring is ever opened to untrusted users.
 */
import "server-only";
import sanitizeHtml from "sanitize-html";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    // Text & inline
    "p",
    "br",
    "span",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "mark",
    "small",
    "sub",
    "sup",
    "abbr",
    "cite",
    "q",
    "del",
    "ins",
    "kbd",
    "samp",
    "var",
    "time",
    // Headings
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    // Structure / layout
    "div",
    "section",
    "article",
    "header",
    "footer",
    "aside",
    "main",
    "nav",
    "hr",
    // Lists
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    // Quotes & code
    "blockquote",
    "code",
    "pre",
    // Media
    "a",
    "img",
    "picture",
    "source",
    "figure",
    "figcaption",
    // Tables
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
    "colgroup",
    "col",
    // Author-supplied CSS. Requires `allowVulnerableTags` below; its contents
    // are kept verbatim so custom classes/selectors work.
    "style",
  ],
  allowedAttributes: {
    // Presentation + hooks allowed on every tag so hand-authored CSS (inline
    // styles, class/id selectors, data-/aria- hooks) renders as written.
    "*": [
      "style",
      "class",
      "id",
      "title",
      "role",
      "align",
      "dir",
      "lang",
      "colspan",
      "rowspan",
      "scope",
      "span",
      "data-*",
      "aria-*",
    ],
    a: ["href", "target", "rel", "name"],
    img: ["src", "srcset", "sizes", "alt", "title", "width", "height", "loading", "decoding"],
    source: ["src", "srcset", "sizes", "media", "type"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"], source: ["http", "https"] },
  // `<style>` is flagged vulnerable by sanitize-html; we accept it for trusted
  // internal authors (see file header). Handlers/scripts remain stripped.
  allowVulnerableTags: true,
  // Keep all CSS on the style attribute (no `allowedStyles` filter) so modern
  // properties — custom properties, grid, var(), gradients — survive verbatim.
  // Drop the entire contents of disallowed tags (default also covers script).
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
