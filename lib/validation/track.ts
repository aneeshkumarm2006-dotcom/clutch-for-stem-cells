/**
 * Zod schema for the public analytics beacon `/api/track` (Stage 9.2).
 *
 * Only client-originated, non-PII events are accepted, and only from the
 * allowlisted set. `props` is a small bag of primitive values (counts, slugs,
 * facet keys) — capped so the endpoint can't be used to write arbitrary blobs.
 */
import { z } from "zod";

/**
 * Event names a browser may report (subset of the server-side allowlist).
 *
 * `search` covers typeahead outcomes the server never sees: which kind of
 * suggestion got picked, and which queries returned nothing. Only the shape of
 * the result travels, never the search term, since a search here can name a
 * medical condition.
 */
export const TRACKABLE_CLIENT_EVENTS = [
  "profile_view",
  "filter_use",
  "search",
  // Guide-capture impressions and dismissals. The submission itself is counted
  // server-side (see `/api/email-capture`), so only the two events a browser is
  // the sole witness to travel over this endpoint.
  "guide_modal_shown",
  "guide_modal_dismissed",
] as const;

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export const trackEventSchema = z.object({
  name: z.enum(TRACKABLE_CLIENT_EVENTS),
  clinicId: z
    .string()
    .regex(OBJECT_ID_RE, "Invalid id.")
    .optional(),
  props: z
    .record(z.union([z.string().max(120), z.number(), z.boolean()]))
    .refine((o) => Object.keys(o).length <= 12, "Too many properties.")
    .optional(),
});

export type TrackEventInput = z.infer<typeof trackEventSchema>;
