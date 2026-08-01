/**
 * `next/image` for a URL we do not control.
 *
 * Use this anywhere the `src` comes out of the database — a clinic's cover photo
 * or gallery, a reviewer's portrait, an image an editor dropped into a block.
 * Those URLs are recorded by an importer or typed into the admin panel, so the
 * host is whatever the source happened to be, and a host missing from
 * `config/images.mjs` turns into a `/_next/image` URL our own origin answers
 * with 400 (see `lib/image-host.ts`).
 *
 * Behaviour is otherwise identical to `next/image`: same props, same layout.
 * The only difference is that an off-list host is rendered `unoptimized`, so it
 * loads as the plain third-party URL instead of breaking.
 *
 * Keep `next/image` itself for assets that ship with the app — those are
 * same-origin and always optimizable.
 */
import Image, { type ImageProps } from "next/image";

import { isOptimizableImageSrc } from "@/lib/image-host";

// `alt` is named rather than swept into `...props` so the a11y lint rule can
// still see it on the call sites this wraps.
export function RemoteImage({ src, alt, unoptimized, ...props }: ImageProps) {
  const raw = typeof src === "string" ? src : null;
  return (
    <Image
      src={src}
      alt={alt}
      // A caller that has already decided (a known-local asset, a deliberate
      // opt-out) keeps its choice; the host check only fills in the default.
      unoptimized={unoptimized ?? (raw ? !isOptimizableImageSrc(raw) : false)}
      {...props}
    />
  );
}
