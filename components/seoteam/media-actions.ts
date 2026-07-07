import { toast } from "sonner";

import type { SeoMediaRow } from "@/lib/seoteam/media-data";

/** Copy `text` to the clipboard and confirm with a toast (or error on failure). */
export async function copyToClipboard(
  text: string,
  label = "Copied",
): Promise<void> {
  try {
    await navigator.clipboard?.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Couldn't copy to the clipboard.");
  }
}

/** `![alt](url)` — a Markdown image embed for the given media row. */
export function markdownFor(m: Pick<SeoMediaRow, "url" | "alt">): string {
  return `![${m.alt ?? ""}](${m.url})`;
}

/** `<img src alt width height />` — an HTML snippet for the given media row. */
export function imgTagFor(
  m: Pick<SeoMediaRow, "url" | "alt" | "width" | "height">,
): string {
  const dims =
    m.width && m.height ? ` width="${m.width}" height="${m.height}"` : "";
  return `<img src="${m.url}" alt="${m.alt ?? ""}"${dims} />`;
}
