/**
 * Route-handler helpers for `/api/seoteam/*` — mirrors `lib/admin/api.ts` but
 * gated by the shared-password session instead of a NextAuth role.
 *
 * `withSeoAuth` is defense-in-depth: `middleware.ts` already 401s unauthenticated
 * API calls at the Edge, but per the repo's "never trust the gate alone" rule we
 * re-check the session inside every mutating handler.
 */
import { NextResponse } from "next/server";
import { z, type ZodTypeAny } from "zod";

import { isSeoAuthenticated } from "@/lib/seoteam/auth";

export function ok<T>(data: T, status = 200): Response {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400): Response {
  return NextResponse.json({ error: message }, { status });
}

/** Gate a handler behind a valid SEO-team session; converts errors to JSON. */
export async function withSeoAuth(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    if (!(await isSeoAuthenticated())) return fail("Unauthorized.", 401);
    return await handler();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("SEO team route error:", err);
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
