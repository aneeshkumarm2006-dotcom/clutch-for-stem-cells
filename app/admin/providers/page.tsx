/**
 * Providers `/admin/providers` (PRD §8.8 / Stage 6.10). Admin+.
 */
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { ProvidersView } from "@/components/admin/users/providers-view";
import { getAdminProviders, getPendingClaims } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  await requireRole("admin", "/admin/providers");
  const [providers, claims] = await Promise.all([
    getAdminProviders(),
    getPendingClaims(),
  ]);

  return (
    <>
      <PageHeader title="Providers" />
      <ProvidersView providers={providers} claims={claims} />
    </>
  );
}
