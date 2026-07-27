import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { AnswerBlock } from "@/components/content/answer-block";
import { JsonLd } from "@/components/seo/json-ld";
import { buildJsonLd } from "@/lib/schema/engine";
import { getSchemaContext } from "@/lib/schema/context";
import type { DirectoryBreadcrumb } from "@/components/directory/directory";
import type { PageView } from "@/lib/seoteam/page-data";

/**
 * Renders a composed (block) page: JSON-LD, breadcrumbs, H1, answer-first
 * intro, and the block composition.
 *
 * Shared because a composed page is reachable from two routes — the `/{slug}`
 * catch-all and any route that falls back to a nested page (`/treatments/…`).
 * Keeping the markup in one place is what stops those two from drifting into
 * subtly different pages at different URLs.
 */
export async function ComposedPageView({
  page,
  breadcrumbs,
}: {
  page: PageView;
  /** Trail above the H1. Defaults to Home → this page. */
  breadcrumbs?: DirectoryBreadcrumb[];
}) {
  const ctx = await getSchemaContext();
  const jsonLd = buildJsonLd(
    "page",
    {
      page: {
        name: page.title,
        description: page.intro,
        path: page.path,
        datePublished: page.publishedAt,
        dateModified: page.updatedAt,
      },
      blocks: page.blocks,
    },
    ctx,
    page.schemaOverrides,
  );

  const trail = breadcrumbs ?? [
    { name: "Home", href: "/" },
    { name: page.title, href: page.path },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      <div className="container py-8 md:py-10">
        <Breadcrumbs className="mb-4" items={trail} />

        <header className="max-w-3xl">
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
            {page.title}
          </h1>
        </header>

        {page.intro ? (
          <div className="mt-5 max-w-3xl">
            <AnswerBlock>{page.intro}</AnswerBlock>
          </div>
        ) : null}

        <div className="mt-8 max-w-3xl">
          <BlockRenderer blocks={page.blocks} />
        </div>
      </div>
    </>
  );
}
