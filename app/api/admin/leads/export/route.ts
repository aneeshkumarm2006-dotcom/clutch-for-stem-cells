/**
 * Leads CSV export (PRD §8.4). Honors the status/type filters.
 */
import { withRole } from "@/lib/admin/api";
import { csvResponse, toCsv } from "@/lib/csv";
import { getLeadsForExport } from "@/lib/admin/leads";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return withRole("editor", async () => {
    const { searchParams } = new URL(req.url);
    const rows = await getLeadsForExport({
      status: searchParams.get("status") ?? undefined,
      type: searchParams.get("type") ?? undefined,
    });

    const csv = toCsv(
      [
        "Type",
        "Name",
        "Email",
        "Phone",
        "Country",
        "Clinic",
        "Condition",
        "Treatments",
        "Budget",
        "Timeframe",
        "Status",
        "Source",
        "Created",
      ],
      rows.map((r) => [
        r.type,
        r.name,
        r.email,
        r.phone ?? "",
        r.country ?? "",
        r.clinicName ?? (r.matchedCount ? `${r.matchedCount} matched` : ""),
        r.conditionName ?? "",
        r.treatmentNames.join("; "),
        r.budgetRange ?? "",
        r.timeframe ?? "",
        r.status,
        r.source ?? "",
        r.createdAt ?? "",
      ]),
    );

    return csvResponse("leads.csv", csv);
  });
}
