/**
 * Media library `/admin/media` (PRD §8.11 / Stage 6.13).
 */
import { PageHeader } from "@/components/admin/page-header";
import { ListSearch } from "@/components/admin/list-search";
import { MediaLibrary } from "@/components/admin/media/media-library";
import { getAdminMedia } from "@/lib/admin/media";
import { firstParam, parsePage } from "@/lib/admin/serialize";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const data = await getAdminMedia({
    q: firstParam(searchParams.q),
    page: parsePage(firstParam(searchParams.page)),
  });

  return (
    <>
      <PageHeader title="Media" />
      <div className="p-5 lg:p-7">
        <div className="mb-4">
          <ListSearch placeholder="Search media" />
        </div>
        <MediaLibrary
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
