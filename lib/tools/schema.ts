/**
 * JSON-LD for the calculators.
 *
 * A calculator page is two things at once and the markup should say both: a
 * `WebPage` with an explainer and an FAQ on it, and a `WebApplication` that does
 * something. `webPageJsonLd` and the block adapters already produce the first,
 * so this file adds the second and wires it into the same graph rather than
 * hanging it off on its own.
 *
 * Graph discipline, per the site's schema conventions: no page re-inlines
 * `Organization` or `WebSite` (the layout publishes those once), so everything
 * here references them by `@id`. The hub's `ItemList` points at each tool's
 * `#calculator` node on the tool's own URL, which means a consumer following the
 * list lands on the node that page actually publishes instead of a near-copy
 * invented by the list.
 *
 * The zero-price `Offer` is not decoration. "Is it free" is one of the things an
 * answer engine wants to resolve before recommending a tool, and leaving it
 * unstated is how a free calculator gets described as one you have to sign up
 * for.
 */
import {
  absoluteUrl,
  itemListJsonLd,
  nodeId,
  orgId,
  type JsonLd,
} from "@/lib/seo";
import { DEFAULT_CURRENCY } from "@/config/site";
import { TOOLS, TOOLS_PATH, toolPath, type ToolDef } from "@/config/tools";

/** The `@id` fragment every calculator node carries on its own page. */
export const CALCULATOR_FRAGMENT = "calculator";

/**
 * The `WebApplication` node for one calculator.
 *
 * `HealthApplication` is the closest applicationCategory schema.org offers and
 * is right for the symptom and body-metric tools. The cost tools are financial
 * rather than clinical, so they take `FinanceApplication`, which is also what
 * makes the hub list read as a mixed set rather than eleven health widgets.
 */
export function calculatorJsonLd(tool: ToolDef): JsonLd {
  const path = toolPath(tool.slug);
  const url = absoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": nodeId(path, CALCULATOR_FRAGMENT),
    name: tool.title,
    description: tool.description,
    url,
    applicationCategory:
      tool.category === "Cost and budget"
        ? "FinanceApplication"
        : "HealthApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    // Everything runs in the browser, which is worth stating: it is the reason
    // no result is stored and no account is needed.
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: DEFAULT_CURRENCY,
    },
    isAccessibleForFree: true,
    isPartOf: { "@id": `${url}#webpage` },
    publisher: { "@id": orgId() },
  };
}

/** `ItemList` of every calculator, for the hub page. */
export function toolsItemListJsonLd(name: string): JsonLd {
  return itemListJsonLd(
    TOOLS.map((tool) => ({ path: toolPath(tool.slug), name: tool.name })),
    {
      name,
      path: TOOLS_PATH,
      itemType: "WebApplication",
      itemIdFragment: CALCULATOR_FRAGMENT,
    },
  );
}
