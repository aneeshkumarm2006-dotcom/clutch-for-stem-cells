/**
 * Taxonomy `/admin/taxonomy/[kind]` (PRD §8.5 / Stage 6.7).
 *
 * One page drives all five taxonomies (treatments, conditions, cell sources,
 * accreditations, locations) via the shared config.
 */
import { notFound } from "next/navigation";

import { TaxonomyManager } from "@/components/admin/taxonomy/taxonomy-manager";
import { getTaxonomyView } from "@/lib/admin/taxonomy";

export const dynamic = "force-dynamic";

export default async function AdminTaxonomyPage({
  params,
}: {
  params: { kind: string };
}) {
  const view = await getTaxonomyView(params.kind);
  if (!view) notFound();
  return <TaxonomyManager view={view} />;
}
