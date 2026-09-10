/**
 * Reference exchange rates for the "≈ $X" estimate shown beside a clinic price
 * that is quoted in something other than USD.
 *
 * Why a checked-in table rather than a live feed: the number is an orientation
 * aid, not a quote. A visitor comparing a Seoul clinic at ₩250,000 against a
 * Colorado clinic at $8,500 needs the two on one scale; nobody transacts at the
 * rate on this page, and the clinic bills in its own currency regardless. A
 * static table keeps every clinic page statically renderable, cannot fail at
 * request time, and cannot quietly restate a clinic's price if a feed returns
 * something wrong. The trade-off is that the rates go stale, which is why
 * {@link FX_RATES_AS_OF} is rendered next to the estimate instead of hidden.
 *
 * ── Refreshing ───────────────────────────────────────────────────────────────
 * Re-run the source and paste the result, then bump `FX_RATES_AS_OF`:
 *
 *   curl -s "https://api.frankfurter.dev/v1/latest?base=USD"
 *
 * (Frankfurter serves the ECB reference rates; AED and PAB are USD-pegged and
 * are carried here as fixed values because the ECB set does not include them.)
 * Quarterly is frequent enough for an estimate labelled as one. A rate being a
 * few percent out does not change a decision the estimate exists to inform.
 *
 * ── Adding a currency ────────────────────────────────────────────────────────
 * An unlisted currency renders **no** estimate at all — the price simply shows
 * in its own currency, exactly as it does today. That is deliberate: a made-up
 * rate would be a false statement about what a clinic charges, and a missing
 * estimate is only a missing convenience. So add the currency here when a clinic
 * starts quoting in it; nothing breaks in the meantime.
 */

/** The date the rates below were read, shown to the visitor with the estimate. */
export const FX_RATES_AS_OF = "2026-09-10";

/**
 * Units of each currency per **1 USD** — the direction the source publishes, so
 * refreshing is a copy/paste and cannot be inverted by mistake.
 * USD itself is absent on purpose: it is the target, and a clinic already
 * priced in USD must never be given a redundant "≈ $" twin.
 */
export const FX_UNITS_PER_USD: Readonly<Record<string, number>> = {
  AED: 3.6725,
  AUD: 1.3918,
  CAD: 1.3816,
  CHF: 0.81198,
  EUR: 0.86088,
  GBP: 0.73963,
  INR: 95.44,
  JPY: 154.18,
  KRW: 1343.8,
  MXN: 16.9435,
  PAB: 1,
  SGD: 1.2664,
  THB: 32.995,
  TRY: 48.495,
};
