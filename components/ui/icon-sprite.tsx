/**
 * One copy of the star glyph, for every star on the page to point at.
 *
 * A rating widget draws ten stars: five empty, and five more clipped to the
 * fraction that is filled. Rendered as ten `lucide-react` components that is ten
 * complete `<svg>` elements carrying the same 500-character path, about 6.6 kB
 * per widget. A clinic profile has seven of them, so roughly 46 kB of a 250 kB
 * page is the same star shape written out seventy times. That is the largest
 * thing on these pages after the framework's own payload, it costs real transfer
 * on every request, and it drags the text-to-markup ratio down for nothing.
 *
 * So the path is defined once here as a `<symbol>` and referenced with `<use>`,
 * which turns each star from ~660 bytes into ~60.
 *
 * Rendered in the root layout, not the public one: the admin review queue draws
 * stars too, and a `<use>` whose symbol is missing renders nothing at all.
 *
 * **The symbol deliberately sets no `fill` or `stroke`.** A presentation
 * attribute beats an inherited value, so declaring either here would freeze the
 * colour and defeat the empty/filled pair the widget is built from. Colour comes
 * from the referencing `<svg>` and inherits through the `<use>`.
 */

/** Lucide's `star`, viewBox `0 0 24 24`. Keep in sync if the icon set changes. */
const STAR_PATH =
  "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z";

/** The `id` a `<use>` points at. Exported so the two can never drift apart. */
export const STAR_SYMBOL_ID = "ui-star";

export function IconSprite() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      // Out of flow and zero-sized rather than `display:none`, which stops some
      // browsers resolving `<use>` references into it at all.
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        overflow: "hidden",
      }}
    >
      <symbol
        id={STAR_SYMBOL_ID}
        viewBox="0 0 24 24"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={STAR_PATH} />
      </symbol>
    </svg>
  );
}
