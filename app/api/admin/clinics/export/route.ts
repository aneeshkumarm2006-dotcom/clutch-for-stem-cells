/**
 * Clinics CSV export (PRD §8.2). Honors the same filters as the list view.
 */
import { withRole } from "@/lib/admin/api";
import { csvResponse, toCsv } from "@/lib/csv";
import { getClinicsForExport } from "@/lib/admin/clinics";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return withRole("editor", async () => {
    const { searchParams } = new URL(req.url);
    const rows = await getClinicsForExport({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      tier: searchParams.get("tier") ?? undefined,
      country: searchParams.get("country") ?? undefined,
      treatment: searchParams.get("treatment") ?? undefined,
      verified: searchParams.get("verified") === "1" || undefined,
    });

    const csv = toCsv(
      [
        "Name",
        "Slug",
        "Status",
        "Tier",
        "Verified",
        "Rating",
        "Reviews",
        "Location",
        "Updated",
      ],
      rows.map((r) => [
        r.name,
        r.slug,
        r.status,
        r.tier,
        r.isVerified ? "yes" : "no",
        r.ratingAvg,
        r.reviewCount,
        r.location,
        r.updatedAt ?? "",
      ]),
    );

    return csvResponse("clinics.csv", csv);
  });
}
