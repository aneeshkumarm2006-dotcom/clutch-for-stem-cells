/**
 * Hosts the Next.js image optimizer is allowed to fetch from.
 *
 * `.mjs` on purpose: `next.config.mjs` needs this list to build its
 * `images.remotePatterns`, and the app needs the same list at render time to
 * decide whether a given `src` can go through `/_next/image` at all. One array,
 * both consumers, so the two can never disagree.
 *
 * Why the render-time check matters: a clinic photo, an editor's OG image or an
 * imported logo is an arbitrary URL. Point `next/image` at a host that isn't
 * listed here and the component still emits
 * `/_next/image?url=<host>&w=…`, which the optimizer answers with **400** — a
 * same-origin URL that 404s to a crawler, i.e. a broken *internal* image rather
 * than a broken external one. `isOptimizableImageSrc` (lib/image-host.ts) is how
 * call sites avoid producing that URL in the first place.
 *
 * Adding a host here is a deliberate act: it lets a third party's CDN serve
 * bytes under our origin's image route. Prefer re-hosting the asset on
 * Cloudinary (`lib/media.ts` → `uploadImage`) over widening this list.
 */
export const IMAGE_REMOTE_HOSTS = [
  "res.cloudinary.com",
  "images.unsplash.com",
];

/** The same list in the shape `next.config.mjs` wants. */
export const IMAGE_REMOTE_PATTERNS = IMAGE_REMOTE_HOSTS.map((hostname) => ({
  protocol: "https",
  hostname,
}));
