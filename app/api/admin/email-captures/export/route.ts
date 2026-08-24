/**
 * Guide-capture CSV export. Honors the status / trigger / delivery / search
 * filters on screen, so what downloads is what the operator is looking at.
 */
import { withRole } from "@/lib/admin/api";
import { csvResponse, toCsv } from "@/lib/csv";
import { getCapturesForExport } from "@/lib/admin/email-captures";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return withRole("editor", async () => {
    const { searchParams } = new URL(req.url);
    const rows = await getCapturesForExport({
      status: searchParams.get("status") ?? undefined,
      trigger: searchParams.get("trigger") ?? undefined,
      delivery: searchParams.get("delivery") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });

    const csv = toCsv(
      [
        "Email",
        "Trigger",
        "Status",
        "Delivery",
        "Sent",
        "Team notified",
        "Shortlist size",
        "Shortlist slugs",
        "Clinic profiles viewed",
        "Captured on page",
        "Referrer",
        "UTM source",
        "UTM medium",
        "UTM campaign",
        "Internal note",
        "Captured",
      ],
      rows.map((r) => [
        r.email,
        r.trigger,
        r.status,
        r.delivery,
        r.sentAt ?? "",
        r.ownerNotifiedAt ?? "",
        r.shortlistCount,
        r.shortlistSlugs,
        r.profileViewCount ?? "",
        r.path ?? "",
        r.referrer ?? "",
        r.utmSource ?? "",
        r.utmMedium ?? "",
        r.utmCampaign ?? "",
        r.internalNote ?? "",
        r.capturedAt ?? "",
      ]),
    );

    return csvResponse("guide-captures.csv", csv);
  });
}
