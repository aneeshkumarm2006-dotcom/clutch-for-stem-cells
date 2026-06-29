/** ~200 wpm reading-time estimate in minutes (min 1). */
export function estimateReadingTime(body?: string): number {
  if (!body) return 1;
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
