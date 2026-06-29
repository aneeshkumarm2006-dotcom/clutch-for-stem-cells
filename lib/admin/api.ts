/**
 * Admin route-handler helpers (Stage 6).
 *
 * Every `/api/admin/*` handler is gated **server-side** by role (PRD §3 — never
 * trust the client), validates input with the shared Zod schemas, and records an
 * audit entry on mutation (PRD §8.12). These helpers keep that boilerplate
 * consistent across the ~12 admin route files.
 */
import { NextResponse } from "next/server";
import { z, type ZodTypeAny } from "zod";

import {
  ApiAuthError,
  authErrorResponse,
  requireApiRole,
  type SessionUser,
} from "@/lib/auth";
import type { UserRole } from "@/lib/enums";

/** JSON success. */
export function ok<T>(data: T, status = 200): Response {
  return NextResponse.json(data, { status });
}

/** JSON error with a single human-readable message. */
export function fail(message: string, status = 400): Response {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Gate a handler to `min` role or higher and convert thrown {@link ApiAuthError}
 * (and unexpected errors) into JSON responses. The callback receives the
 * authorized {@link SessionUser} (use `.id` as the audit actor).
 *
 *   export const POST = (req) => withRole("editor", req, async (user) => { … });
 */
export async function withRole(
  min: UserRole,
  handler: (user: SessionUser) => Promise<Response>,
): Promise<Response> {
  try {
    const user = await requireApiRole(min);
    return await handler(user);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    if (err instanceof ApiAuthError) {
      return fail(err.message, err.status);
    }
    // eslint-disable-next-line no-console
    console.error("Admin route error:", err);
    return fail("Something went wrong. Try again.", 500);
  }
}

/** Parse + validate a JSON body; returns the data or a 4xx `Response`. */
export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ data: z.infer<S> } | { error: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: fail("Invalid request body.", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: fail(
        parsed.error.issues[0]?.message ?? "Check the form and try again.",
        422,
      ),
    };
  }
  return { data: parsed.data };
}
