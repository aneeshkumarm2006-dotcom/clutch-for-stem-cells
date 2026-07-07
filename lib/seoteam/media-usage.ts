/**
 * Blog media usage index — "which posts use this image?".
 *
 * The gallery needs to link every library image back to the posts that embed it.
 * Cover images live in `coverImage.url`; inline images live as `<img src>` inside
 * the sanitized HTML `body`. This module scans all posts once and builds a
 * URL → references map the read-layer annotates each media row with.
 *
 * Matching is tolerant: URLs are normalized (query string / trailing slash
 * stripped) so Cloudinary transform variants still resolve to the same original,
 * with a `publicId` substring fallback for delivery URLs that carry transforms.
 *
 * Blog scale (tens–low-hundreds of posts) makes a single full scan cheap, and
 * every caller page is already `force-dynamic`.
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { BlogPost } from "@/models";

export interface UsageRef {
  postId: string;
  title: string;
  slug: string;
  status: string;
  where: "cover" | "inline";
}

export interface UsageIndex {
  /** normalizedUrl → references */
  byUrl: Map<string, UsageRef[]>;
}

/** Strip query string / hash and any trailing slashes for tolerant matching. */
export function normalizeImageUrl(url: string): string {
  const trimmed = url.trim();
  const noQuery = trimmed.split(/[?#]/)[0] ?? trimmed;
  return noQuery.replace(/\/+$/, "");
}

const IMG_SRC_RE = /<img[^>]+src=["']([^"']+)["']/gi;

/** Pull every `<img src>` URL out of an HTML body string. */
export function extractBodyImageUrls(body: string): string[] {
  const urls: string[] = [];
  IMG_SRC_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMG_SRC_RE.exec(body)) !== null) {
    if (m[1]) urls.push(m[1]);
  }
  return urls;
}

/** Best-effort Cloudinary `public_id` recovery from a plain delivery URL. */
export function extractCloudinaryPublicId(url: string): string | undefined {
  const m =
    /res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i.exec(
      url,
    );
  return m?.[1];
}

function dedupeRefs(refs: UsageRef[]): UsageRef[] {
  const seen = new Set<string>();
  const out: UsageRef[] = [];
  for (const r of refs) {
    const key = `${r.postId}|${r.where}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Load all posts and build the URL → references usage index. */
export async function getMediaUsageIndex(): Promise<UsageIndex> {
  await dbConnect();
  const posts = await BlogPost.find(
    {},
    { title: 1, slug: 1, status: 1, "coverImage.url": 1, body: 1 },
  ).lean();

  const byUrl = new Map<string, UsageRef[]>();
  const add = (url: string | undefined | null, ref: UsageRef) => {
    if (!url) return;
    const key = normalizeImageUrl(url);
    if (!key) return;
    const list = byUrl.get(key);
    if (list) list.push(ref);
    else byUrl.set(key, [ref]);
  };

  for (const p of posts) {
    const base = {
      postId: String(p._id),
      title: p.title,
      slug: p.slug,
      status: p.status as string,
    };
    add(p.coverImage?.url, { ...base, where: "cover" });
    if (p.body) {
      for (const u of extractBodyImageUrls(p.body)) {
        add(u, { ...base, where: "inline" });
      }
    }
  }

  return { byUrl };
}

/** Resolve the posts using a given media item (direct URL, then publicId). */
export function lookupUsage(
  index: UsageIndex,
  media: { url: string; publicId?: string },
): UsageRef[] {
  const normalized = normalizeImageUrl(media.url);
  const refs: UsageRef[] = [];
  const direct = index.byUrl.get(normalized);
  if (direct) refs.push(...direct);
  if (media.publicId) {
    for (const [key, list] of index.byUrl) {
      if (key !== normalized && key.includes(media.publicId)) refs.push(...list);
    }
  }
  return dedupeRefs(refs);
}

/** Distinct original image URLs referenced by any post (for backfill). */
export async function collectUsedImageUrls(): Promise<string[]> {
  await dbConnect();
  const posts = await BlogPost.find(
    {},
    { "coverImage.url": 1, body: 1 },
  ).lean();

  const seen = new Set<string>();
  const urls: string[] = [];
  const push = (u: string | undefined | null) => {
    if (!u) return;
    const key = normalizeImageUrl(u);
    if (!key || seen.has(key)) return;
    seen.add(key);
    urls.push(u.trim());
  };

  for (const p of posts) {
    push(p.coverImage?.url);
    if (p.body) for (const u of extractBodyImageUrls(p.body)) push(u);
  }

  return urls;
}
