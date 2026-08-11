import * as React from "react";

/**
 * Third-party platform marks — Google and Reddit, in their own brand colours.
 *
 * These are used wherever the site attributes something to an off-site source
 * (the `ExternalReviews` panels, the "Continue with Google" button). Two rules:
 *
 *  - **Inline SVG, never a remote file.** `next/image` only loads hosts listed
 *    in `remotePatterns`, and a logo is small enough that a network round trip
 *    for it is pure cost. Paths are the official marks, not redrawings.
 *  - **Decorative by default.** Every place a mark appears, the platform is
 *    already named in adjacent text ("Google reviews", "Continue with Google"),
 *    so the SVG is `aria-hidden` and a screen reader hears the name once rather
 *    than twice. Pass `aria-hidden={false}` with a `<title>`-bearing label only
 *    if a mark ever has to stand alone.
 *
 * Both accept the usual SVG props, so size comes from a `className`
 * (`size-[18px]`) at the call site rather than a prop of our own.
 */

/** Google's four-colour "G". */
export function GoogleMark({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        fill="#4285F4"
        d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-7.9Z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .6-2.2 1-3.7 1-2.8 0-5.2-1.9-6-4.5H2.3v2.8A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M6 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.3a11 11 0 0 0 0 9.8L6 14.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3 .5 4.1 1.6l3-3A11 11 0 0 0 2.3 7.1L6 9.9c.8-2.6 3.2-4.5 6-4.5Z"
      />
    </svg>
  );
}

/** Reddit's Snoo mark in Orangered (#FF4500). */
export function RedditMark({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        fill="#FF4500"
        d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z"
      />
    </svg>
  );
}
