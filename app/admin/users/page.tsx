/**
 * Users `/admin/users` (PRD §8.8 / Stage 6.10). Admin+ (SuperAdmin to manage
 * other admins — enforced in the API).
 */
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { UsersManager } from "@/components/admin/users/users-manager";
import { getAdminUsers } from "@/lib/admin/users";
import { getClinicOptions } from "@/lib/admin/lookups";
import { firstParam, parsePage } from "@/lib/admin/serialize";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await requireRole("admin", "/admin/users");

  const [data, clinicOptions] = await Promise.all([
    getAdminUsers({
      q: firstParam(searchParams.q),
      role: firstParam(searchParams.role),
      status: firstParam(searchParams.status),
      page: parsePage(firstParam(searchParams.page)),
    }),
    getClinicOptions(),
  ]);

  return (
    <>
      <PageHeader title="Users" />
      <div className="p-5 lg:p-7">
        <UsersManager
          rows={data.rows}
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          clinicOptions={clinicOptions}
        />
      </div>
    </>
  );
}
