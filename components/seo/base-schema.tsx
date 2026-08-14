/**
 * Site-wide base schema — the `Organization` + `WebSite` nodes every public page
 * carries.
 *
 * Mounted once in the public layout, so it is emitted on all ~40 public pages
 * rather than only the homepage (which is where it used to live). The two nodes
 * carry stable `@id`s and `WebSite.publisher` points at the `Organization`, so a
 * crawler reads one connected graph instead of two orphans.
 *
 * Identity comes from admin Settings (name, logo, socials) with the
 * `config/content-engine` values as fallback, so changing the logo or adding a
 * social profile updates every page with no deploy.
 */
import * as React from "react";

import { JsonLd } from "@/components/seo/json-ld";
import { getSchemaContext } from "@/lib/schema/context";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export async function BaseSchema() {
  const ctx = await getSchemaContext();

  const identity = {
    name: ctx.siteName,
    url: ctx.siteUrl,
    logo: ctx.logo,
    sameAs: ctx.sameAs,
    type: ctx.organizationType,
    searchPath: ctx.searchPath,
    description: ctx.description,
    email: ctx.email,
    telephone: ctx.telephone,
    address: ctx.address,
    contactPath: ctx.contactPath,
    knowsAbout: ctx.knowsAbout,
    policies: ctx.policies,
  };

  return (
    <JsonLd data={[organizationJsonLd(identity), websiteJsonLd(identity)]} />
  );
}
