/**
 * `POST /api/seoteam/schema/preview` — live JSON-LD preview for the schema panel.
 *
 * Read-only: it builds and validates a graph from the editor's unsaved draft and
 * returns it. Nothing is persisted. Runs the same engine the public page runs,
 * so what the editor sees is what the crawler gets.
 */
import { ok, parseBody, withSeoAuth } from "@/lib/seoteam/api";
import { buildSchemaPreview, schemaPreviewSchema } from "@/lib/schema/preview";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const parsed = await parseBody(req, schemaPreviewSchema);
    if ("error" in parsed) return parsed.error;

    const result = await buildSchemaPreview(parsed.data);
    return ok(result);
  });
}
