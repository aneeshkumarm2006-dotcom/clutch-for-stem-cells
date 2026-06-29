/**
 * Audit log `/admin/audit-log` (PRD §8.12 / Stage 6.14). SuperAdmin, read-only.
 */
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { ListSearch } from "@/components/admin/list-search";
import { AuditEntityFilter } from "@/components/admin/audit/audit-entity-filter";
import { AuditTable } from "@/components/admin/audit/audit-table";
import { getAdminAuditLog } from "@/lib/admin/audit";
import { firstParam, parsePage } from "@/lib/admin/serialize";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await requireRole("superadmin", "/admin/audit-log");

  const data = await getAdminAuditLog({
    q: firstParam(searchParams.q),
    entityType: firstParam(searchParams.entityType),
    page: parsePage(firstParam(searchParams.page)),
  });

  return (
    <>
      <PageHeader title="Audit log" />
      <div className="space-y-3.5 p-5 lg:p-7">
        <div className="flex flex-wrap items-center gap-2.5">
          <ListSearch placeholder="Search actions" />
          <AuditEntityFilter entityTypes={data.entityTypes} />
        </div>
        <AuditTable
          rows={data.rows}
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
        />
      </div>
    </>
  );
}
