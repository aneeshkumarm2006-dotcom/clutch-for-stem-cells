/**
 * User create `/api/admin/users` (PRD §8.8 / Stage 6.10). Admin+.
 * Admin-created accounts are pre-verified. Creating an Admin/SuperAdmin requires
 * SuperAdmin.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { userAdminCreateSchema } from "@/lib/validation/user";
import { roleAtLeast } from "@/lib/enums";
import { Clinic, User } from "@/models";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return withRole("admin", async (actor) => {
    const parsed = await parseBody(req, userAdminCreateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    // Only a SuperAdmin can mint Admin/SuperAdmin accounts.
    if (
      roleAtLeast(data.role, "admin") &&
      !roleAtLeast(actor.role ?? "member", "superadmin")
    ) {
      return fail("Only a Super Admin can create admin accounts.", 403);
    }

    await dbConnect();
    if (await User.exists({ email: data.email })) {
      return fail("A user with that email already exists.", 409);
    }

    const user = await User.create({
      name: data.name,
      email: data.email,
      role: data.role,
      status: data.status,
      provider: data.provider,
      passwordHash: data.password
        ? await hashPassword(data.password)
        : undefined,
      // Admin-created accounts skip email verification.
      emailVerified: new Date(),
    });

    if (data.ownerClinicId) {
      await Clinic.updateOne(
        { _id: data.ownerClinicId },
        { $set: { ownerUserId: user._id } },
      );
    }

    await recordAuditFromRequest(req, {
      actorUserId: actor.id,
      action: "user.create",
      entityType: "User",
      entityId: user._id,
      after: { email: user.email, role: user.role },
    });

    return ok({ id: String(user._id) }, 201);
  });
}
