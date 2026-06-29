"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useQueryParams } from "@/components/admin/use-query-params";
import { cn } from "@/lib/utils";

/** Debounced URL-bound search box for admin list views (writes `?q=`). */
export function ListSearch({
  placeholder = "Search",
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const { searchParams, setParams } = useQueryParams();
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  React.useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(
      () => setParams({ q: q || null }, { resetPage: true }),
      350,
    );
    return () => clearTimeout(t);
  }, [q, searchParams, setParams]);

  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9"
      />
    </div>
  );
}
