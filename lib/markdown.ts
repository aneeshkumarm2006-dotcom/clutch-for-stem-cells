/**
 * Minimal markdown → HTML renderer for article bodies (Stage 5.8).
 *
 * Escapes HTML **first**, then applies a small, safe subset (headings, bold,
 * italics, links, blockquotes, unordered lists, paragraphs). Escape-first means
 * the output can't smuggle markup, so it's safe for `dangerouslySetInnerHTML`
 * (PRD §13). A full MDX/TipTap pipeline is the admin CMS's job (Stage 6.8); this
 * keeps the public article page dependency-free.
 */
function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

function inline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
      '<a href="$2" class="text-text-link underline hover:no-underline">$1</a>',
    );
}

export function renderMarkdown(markdown: string): string {
  const lines = escapeHtml(markdown).split(/\r?\n/);
  const html: string[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      html.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    if (line.startsWith("### ")) {
      flushPara();
      flushList();
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      flushPara();
      flushList();
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      flushPara();
      flushList();
      html.push(`<h2>${inline(line.slice(2))}</h2>`);
    } else if (line.startsWith("> ")) {
      flushPara();
      flushList();
      html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    } else if (/^[-*]\s+/.test(line)) {
      flushPara();
      list.push(line.replace(/^[-*]\s+/, ""));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return html.join("\n");
}
