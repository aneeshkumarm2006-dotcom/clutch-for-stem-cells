/**
 * CSV export helper (PRD §8.2/§8.4 — clinics & leads export).
 *
 * Dependency-free RFC-4180-ish serialization: quotes every field, escapes inner
 * quotes by doubling, and prefixes a value that begins with `= + - @` with a
 * single quote to defuse spreadsheet formula injection (security — PRD §13).
 */

type CsvCell = string | number | boolean | null | undefined;

function escapeCell(value: CsvCell): string {
  if (value == null) return '""';
  let str = String(value);
  // Neutralize CSV formula injection in spreadsheet apps.
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return `"${str.replace(/"/g, '""')}"`;
}

/** Build a CSV string from a header row + data rows. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCell).join(","));
  // CRLF + leading BOM so Excel detects UTF-8.
  return "﻿" + lines.join("\r\n");
}

/** Wrap CSV text in a downloadable `Response` with a filename. */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
