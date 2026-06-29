import { redirect } from "next/navigation";

/** `/admin/taxonomy` → the first taxonomy kind. */
export default function TaxonomyIndexPage() {
  redirect("/admin/taxonomy/treatments");
}
