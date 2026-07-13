/**
 * Test stub for `next/cache`.
 *
 * `unstable_cache` needs Next's request store, which doesn't exist under
 * `node --test`. Here it degrades to a pass-through: the wrapped function runs
 * on every call. That's exactly what we want when testing the *logic* inside it
 * (redirect resolution) — caching is Next's concern, not ours, and a live
 * lookup is the stricter test anyway.
 */
export function unstable_cache<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return fn;
}

export function revalidateTag(): void {
  /* no-op in tests */
}

export function revalidatePath(): void {
  /* no-op in tests */
}
