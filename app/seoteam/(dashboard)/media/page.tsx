import type { Metadata } from "next";

import {
  getSeoMedia,
  type MediaSort,
  type SeoMediaQuery,
} from "@/lib/seoteam/media-data";
import { firstParam, parsePage } from "@/lib/admin/serialize";
import { MediaManager } from "@/components/seoteam/media-manager";

export const metadata: Metadata = {
  title: "Media · SEO Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

const SORTS: MediaSort[] = ["newest", "name", "size", "usage", "dimensions"];

function parseFilter(v: string | undefined): SeoMediaQuery["filter"] {
  if (v === "unused") return "unused";
  if (v === "missing-alt") return "missing-alt";
  return undefined;
}

function fmtBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="font-display text-2xl font-bold tabular-nums text-text-primary">
        {value}
      </div>
      <div className="mt-0.5 text-[13px] text-text-muted">{label}</div>
    </div>
  );
}

export default async function SeoMediaPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sortParam = firstParam(searchParams.sort);
  const data = await getSeoMedia({
    q: firstParam(searchParams.q),
    folder: firstParam(searchParams.folder),
    sort: SORTS.includes(sortParam as MediaSort)
      ? (sortParam as MediaSort)
      : undefined,
    filter: parseFilter(firstParam(searchParams.filter)),
    page: parsePage(firstParam(searchParams.page)),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary">
          Media
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your blog images, see where each one is used, and bulk-import
          in one place.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Images" value={data.stats.total} />
        <StatCard label="Used in posts" value={data.stats.used} />
        <StatCard label="Unused" value={data.stats.unused} />
        <StatCard label="Storage" value={fmtBytes(data.stats.totalBytes)} />
      </div>

      <MediaManager data={data} />
    </div>
  );
}
