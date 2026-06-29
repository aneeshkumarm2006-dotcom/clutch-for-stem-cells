/**
 * User management `/api/admin/users/[id]` (PRD §8.8 / Stage 6.10). Admin+.
 *
 * Action-based PATCH (role/suspend/activate/reset-password/edit) + soft DELETE.
 * Touching an Admin/SuperAdmin — or promoting to one — requires SuperAdmin.
 * Admins can't suspend/delete/demote themselves.
 */
import { z } from "zod";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { createToken, expiryFromNow, PASSWORD_RESET_TTL_HOURS } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { roleAtLeast, USER_ROLES } from "@/lib/enums";
import { User } from "@/models";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  action: z.enum(["setRole", "suspend", "activate", "resetPassword", "edit"]),
  role: z.enum(USER_ROLES).optional(),
  name: z.string().max(160).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("admin", async (actor) => {
    const parsed = await parseBody(req, patchSchema);
    if ("error" in parsed) return parsed.error;
    const { action, role, name } = parsed.data;

    await dbConnect();
    const user = await User.findById(params.id);
    if (!user || user.isDeleted) return fail("User not found.", 404);

    const isSuper = roleAtLeast(actor.role ?? "member", "superadmin");
    const isSelf = actor.id === String(user._id);

    // Privilege guard: only SuperAdmin can touch admin-level accounts or grant
    // admin-level roles.
    const touchesAdmin =
      roleAtLeast(user.role, "admin") ||
      (action === "setRole" && role && roleAtLeast(role, "admin"));
    if (touchesAdmin && !isSuper) {
      return fail("Only a Super Admin can manage admin accounts.", 403);
    }

    switch (action) {
      case "setRole":
        if (!role) return fail("Choose a role.", 422);
        if (isSelf) return fail("You can't change your own role.", 400);
        user.role = role;
        break;
      case "suspend":
        if (isSelf) return fail("You can't suspend your own account.", 400);
        user.status = "suspended";
        break;
      case "activate":
        user.status = "active";
        break;
      case "edit":
        if (name !== undefined) user.name = name;
        break;
      case "resetPassword": {
        const { token, tokenHash } = createToken();
        user.passwordResetToken = tokenHash;
        user.passwordResetExpires = expiryFromNow(PASSWORD_RESET_TTL_HOURS);
        await user.save();
        try {
          await sendPasswordResetEmail(user.email, token);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("Password reset email failed:", err);
        }
        await recordAuditFromRequest(req, {
          actorUserId: actor.id,
          action: "user.update",
          entityType: "User",
          entityId: user._id,
          after: { resetPasswordSent: true },
        });
        return ok({ ok: true });
      }
      default:
        return fail("Unknown action.", 400);
    }

    await user.save();
    await recordAuditFromRequest(req, {
      actorUserId: actor.id,
      action: action === "setRole" ? "user.role" : "user.update",
      entityType: "User",
      entityId: user._id,
      after: { role: user.role, status: user.status },
    });

    return ok({ ok: true });
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("admin", async (actor) => {
    await dbConnect();
    const user = await User.findById(params.id);
    if (!user || user.isDeleted) return fail("User not found.", 404);

    if (actor.id === String(user._id)) {
      return fail("You can't delete your own account here.", 400);
    }
    if (
      roleAtLeast(user.role, "admin") &&
      !roleAtLeast(actor.role ?? "member", "superadmin")
    ) {
      return fail("Only a Super Admin can delete admin accounts.", 403);
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.status = "suspended";
    user.email = `deleted+${user._id}@deleted.invalid`;
    user.passwordHash = undefined;
    await user.save();

    await recordAuditFromRequest(req, {
      actorUserId: actor.id,
      action: "user.delete",
      entityType: "User",
      entityId: params.id,
    });

    return ok({ ok: true });
  });
}
