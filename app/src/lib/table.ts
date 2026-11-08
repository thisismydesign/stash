// Relative imports only: tests run this under Node.

import type { Cell, Column, SharedRow } from "../../../shared/tables.ts";

/** What narrows the rows shown: text in any cell, chosen options, ticked boxes, dates from and to. */
export type Filter = {
  query: string;
  choices: Record<string, string[]>;
  ticked: Record<string, boolean>;
  from: Record<string, string>;
  to: Record<string, string>;
};

export const NO_FILTER: Filter = { query: "", choices: {}, ticked: {}, from: {}, to: {} };

export const formatNumber = (n: number, decimals?: number) =>
  n.toLocaleString("en", {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 10,
  });

/** A cell as it reads; a value of the wrong type reads as text. */
export function formatCell(column: Column, value: Cell | undefined): string {
  if (value == null) return "";
  if (typeof value === "number") return formatNumber(value, column.decimals);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
}

/** What a number column's cells add up to; float noise rounded off. */
export const total = (rows: readonly SharedRow[], key: string) =>
  Number(
    rows
      .reduce((sum, r) => sum + (typeof r.data[key] === "number" ? r.data[key] : 0), 0)
      .toPrecision(15),
  );

export const isFiltering = (f: Filter) =>
  f.query.trim() !== "" ||
  Object.values(f.choices).some((c) => c.length > 0) ||
  Object.values(f.ticked).some(Boolean) ||
  Object.values(f.from).some(Boolean) ||
  Object.values(f.to).some(Boolean);

export function passes(columns: Column[], filter: Filter, row: SharedRow): boolean {
  const q = filter.query.trim().toLowerCase();
  if (q && !columns.some((c) => formatCell(c, row.data[c.key]).toLowerCase().includes(q)))
    return false;
  return columns.every((c) => {
    const v = row.data[c.key];
    const chosen = filter.choices[c.key] ?? [];
    if (chosen.length > 0 && !chosen.includes(String(v))) return false;
    if (filter.ticked[c.key] && v !== true) return false;
    const from = filter.from[c.key];
    const to = filter.to[c.key];
    if ((from || to) && typeof v !== "string") return false;
    if (from && (v as string) < from) return false;
    if (to && (v as string) > to) return false;
    return true;
  });
}
