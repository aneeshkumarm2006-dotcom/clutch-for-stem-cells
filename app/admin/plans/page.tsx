/**
 * Plans `/admin/plans` (PRD §8.9 / Stage 6.11). Admin+.
 */
import { requireRole } from "@/lib/auth";
import { PlansManager } from "@/components/admin/plans/plans-manager";
import { getAdminPlans } from "@/lib/admin/plans";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  await requireRole("admin", "/admin/plans");
  const plans = await getAdminPlans();
  return <PlansManager plans={plans} />;
}
