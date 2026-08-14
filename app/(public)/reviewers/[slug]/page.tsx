import { notFound } from "next/navigation";
import Link from "next/link";
import { RemoteImage } from "@/components/common/remote-image";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

import { pageMetadata } from "@/lib/page-metadata";
import { buildJsonLd } from "@/lib/schema/engine";
import { getSchemaContext } from "@/lib/schema/context";
import {
  getActiveReviewerSlugs,
  getReviewerBySlug,
} from "@/lib/seoteam/reviewer-data";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { getInitials } from "@/lib/format";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const slugs = await getActiveReviewerSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const r = await getReviewerBySlug(params.slug);
  if (!r) return pageMetadata({ title: "Reviewer not found" });
  const name = r.credentials ? `${r.name}, ${r.credentials}` : r.name;
  return pageMetadata({
    title: name,
    description:
      r.title ?? `${r.name} medically reviews content on our directory.`,
    path: `/reviewers/${r.slug}`,
    type: "profile",
    image: r.photoUrl,
  });
}

export default async function ReviewerBioPage({
  params,
}: {
  params: { slug: string };
}) {
  const r = await getReviewerBySlug(params.slug);
  if (!r) notFound();

  const path = `/reviewers/${r.slug}`;
  // `ProfilePage` wrapping the `Person`, via the schema engine — the type Google
  // documents for author/reviewer bios and one of the few it still actively
  // supports. The nested `Person` carries the `@id` that every `reviewedBy`
  // across the site points at, so this page is where that entity is defined.
  const ctx = await getSchemaContext();
  const jsonLd = buildJsonLd(
    "reviewer",
    {
      person: {
        name: r.name,
        path,
        credentials: r.credentials,
        jobTitle: r.title,
        description: r.bio,
        image: r.photoUrl,
        sameAs: r.sameAs,
        identifier: r.id,
      },
      dateCreated: r.createdAt,
      dateModified: r.updatedAt,
    },
    ctx,
  );

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="container max-w-3xl py-8 md:py-10">
        <Breadcrumbs
          className="mb-4"
          items={[
            { name: "Home", href: "/" },
            { name: "Editorial team", href: "/editorial-policy" },
            { name: r.name, href: path },
          ]}
        />

        <div className="flex items-start gap-5">
          <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-tint font-display text-xl font-bold text-azure-700">
            {r.photoUrl ? (
              <RemoteImage
                src={r.photoUrl}
                alt={r.name}
                width={80}
                height={80}
                className="size-full object-cover"
              />
            ) : (
              getInitials(r.name)
            )}
          </span>
          <div>
            <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-text-primary">
              {r.name}
              {r.credentials ? (
                <span className="text-text-secondary">, {r.credentials}</span>
              ) : null}
            </h1>
            {r.title ? (
              <p className="mt-1 text-[15px] text-text-secondary">{r.title}</p>
            ) : null}
          </div>
        </div>

        {r.bio ? (
          <p className="mt-6 whitespace-pre-line text-[15px] leading-relaxed text-text-secondary">
            {r.bio}
          </p>
        ) : null}

        {r.sameAs.length ? (
          <div className="mt-6">
            <h2 className="text-[13px] font-semibold text-text-primary">
              Profiles
            </h2>
            <ul className="mt-2 space-y-1.5">
              {r.sameAs.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-[14px] text-text-link hover:underline"
                  >
                    {url}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-8 border-t border-border pt-6 text-[13px] text-text-muted">
          Our reviewers verify factual accuracy and cautious framing. Reviewed
          content is informational only and not a substitute for professional
          medical advice. See our{" "}
          <Link
            href="/editorial-policy"
            className="text-text-link hover:underline"
          >
            editorial policy
          </Link>
          .
        </p>
      </div>
    </>
  );
}
