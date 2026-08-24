/**
 * Resend a guide email `/api/admin/email-captures/[id]/resend`. Editor+.
 *
 * The capture route sends once and records the outcome; this is the manual
 * retry for a record that came back `failed`, or that was captured while SMTP
 * was misconfigured (`skipped`). It rebuilds the email from the *current*
 * clinics behind the saved slugs rather than from a stored copy, so a resend a
 * week later reflects the directory as it is now.
 *
 * A record an operator marked `unsubscribed` is refused outright. That flag
 * exists precisely so nobody can be re-mailed by clicking a button.
 */
import { GUIDE_QUESTIONS } from "@/config/guide-capture";
import { fail, ok, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { dbConnect } from "@/lib/db";
import { sendShortlistGuideEmail } from "@/lib/email";
import { Clinic, EmailCapture } from "@/models";
import type { IClinic } from "@/models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    await dbConnect();
    const capture = await EmailCapture.findById(params.id);
    if (!capture) return fail("Capture not found.", 404);
    if (capture.status === "unsubscribed") {
      return fail("This address is marked unsubscribed.", 409);
    }

    const slugs = capture.shortlistSlugs ?? [];
    const clinics = slugs.length
      ? await Clinic.find({
          slug: { $in: slugs },
          status: "published",
          isDeleted: false,
        })
          .select("name slug tagline locations")
          .lean<IClinic[]>()
      : [];
    const order = new Map(slugs.map((s, i) => [s, i]));
    clinics.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));

    const result = await sendShortlistGuideEmail({
      to: capture.email,
      clinics: clinics.map((c) => {
        const primary = c.locations?.[0];
        return {
          name: c.name,
          slug: c.slug,
          location: [primary?.city, primary?.country].filter(Boolean).join(", "),
          focus: c.tagline,
        };
      }),
      questions: GUIDE_QUESTIONS,
    });

    capture.delivery = result.ok ? "sent" : result.skipped ? "skipped" : "failed";
    capture.sentAt = result.ok ? new Date() : capture.sentAt;
    capture.deliveryError = result.ok
      ? undefined
      : (result.error ?? result.skipped);
    if (result.ok) capture.resendCount = (capture.resendCount ?? 0) + 1;
    await capture.save();

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "capture.resend",
      entityType: "EmailCapture",
      entityId: capture._id,
      after: { delivery: capture.delivery },
    });

    if (!result.ok) {
      return fail(
        result.error ?? result.skipped ?? "The email could not be sent.",
        502,
      );
    }
    return ok({ ok: true });
  });
}
