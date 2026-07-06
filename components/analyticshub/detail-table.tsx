import type { DetailTable } from "@/lib/analyticshub/types";
import { cn } from "@/lib/utils";

/** Renders a normalized top-N table (GA4 pages/sources, GSC queries, signups). */
export function DetailTableView({ table }: { table: DetailTable }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold text-text-primary">
        {table.title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
              {table.columns.map((c, i) => (
                <th
                  key={c}
                  className={cn(
                    "whitespace-nowrap px-4 py-2 font-medium",
                    i > 0 && "text-right",
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.columns.length}
                  className="px-4 py-8 text-center text-text-muted"
                >
                  No data in this range yet.
                </td>
              </tr>
            ) : (
              table.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-border/60 last:border-0 hover:bg-surface-alt"
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "px-4 py-2 tabular-nums",
                        ci === 0
                          ? "max-w-[18rem] truncate text-text-primary"
                          : "whitespace-nowrap text-right text-text-secondary",
                      )}
                      title={ci === 0 ? String(cell) : undefined}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
