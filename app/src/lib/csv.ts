import type { Column, SharedRow } from "@shared/tables.ts";

// RFC 4180: CRLF between records, quotes around a field holding a comma, a quote or a line break.
const field = (text: string) => (/[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/** A table as CSV: the column names, then each row's cells as stored. */
export function toCsv(columns: Column[], rows: readonly SharedRow[]): string {
  const cell = (value: unknown) => (value == null ? "" : String(value));
  const lines = [
    columns.map((c) => field(c.name)),
    ...rows.map((r) => columns.map((c) => field(cell(r.data[c.key])))),
  ];
  return lines.map((l) => l.join(",")).join("\r\n") + "\r\n";
}

export const csvFileName = (title: string) =>
  `${
    title
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "table"
  }.csv`;

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
