import Link from "next/link";
import type { Metadata } from "next";
import { SearchX } from "lucide-react";

import { buildMetadata } from "@/lib/seo";
import { globalSearch } from "@/lib/public-data";
import { trackEvent } from "@/lib/analytics";
import { SearchBar } from "@/components/search/search-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ClinicCardGrid } from "@/components/clinic/savable-clinic-card";
import { ArticleCard } from "@/components/article/article-card";
import { formatCount } from "@/lib/format";

export const metadata: Metadata = buildMetadata({
  title: "Search",
  description: "Search clinics, treatments, conditions, and patient resources.",
  path: "/search",
});

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams.q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const results = query
    ? await globalSearch(query)
    : { clinics: [], clinicTotal: 0, articles: [], articleTotal: 0 };

  if (query) {
    // Track searches (incl. zero-result) without PII — PRD §15.
    void trackEvent("search", {
      length: query.length,
      clinics: results.clinicTotal,
      articles: results.articleTotal,
      zeroResult: results.clinicTotal + results.articleTotal === 0,
    });
  }

  const hasResults = results.clinics.length + results.articles.length > 0;

  return (
    <div className="container py-10 md:py-14">
      <header className="max-w-2xl">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary">
          {query ? `Results for “${query}”` : "Search"}
        </h1>
        <p className="mt-2 text-[15px] text-text-secondary">
          Search across clinics, treatments, conditions, and patient resources.
        </p>
        <div className="mt-5">
          <SearchBar
            action="/search"
            showLocation={false}
            defaultQuery={query}
            queryPlaceholder="Search clinics, treatments, conditions…"
          />
        </div>
      </header>

      {!query ? null : !hasResults ? (
        <div className="mt-10">
          <EmptyState
            icon={SearchX}
            title="No results found"
            description="Try a different term, or browse clinics by treatment, condition, or destination."
            action={
              <Link
                href="/clinics"
                className="text-sm font-semibold text-text-link hover:underline"
              >
                Browse all clinics
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-10 space-y-12">
          {results.clinics.length ? (
            <section>
              <h2 className="mb-4 font-display text-xl font-semibold text-text-primary">
                Clinics{" "}
                <span className="text-text-muted">
                  ({formatCount(results.clinicTotal)})
                </span>
              </h2>
              <ClinicCardGrid clinics={results.clinics} columns={2} />
              {results.clinicTotal > results.clinics.length ? (
                <Link
                  href={`/clinics?q=${encodeURIComponent(query)}`}
                  className="mt-5 inline-block text-sm font-semibold text-text-link hover:underline"
                >
                  See all {formatCount(results.clinicTotal)} clinics
                </Link>
              ) : null}
            </section>
          ) : null}

          {results.articles.length ? (
            <section>
              <h2 className="mb-4 font-display text-xl font-semibold text-text-primary">
                Resources{" "}
                <span className="text-text-muted">
                  ({formatCount(results.articleTotal)})
                </span>
              </h2>
              <div className="grid gap-5 md:grid-cols-3">
                {results.articles.map((a) => (
                  <ArticleCard key={a.slug} article={a} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
