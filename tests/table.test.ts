import assert from "node:assert/strict";
import { test } from "node:test";
import { columnKey, readColumns, toCell, type Column } from "../shared/tables.ts";
import { csvFileName, toCsv } from "../app/src/lib/csv.ts";
import { moveItem, passes, total } from "../app/src/lib/table.ts";

const COLUMNS: Column[] = [
  { key: "date", name: "Date", type: "date" },
  { key: "what", name: "What", type: "text" },
  { key: "amount", name: "Amount", type: "number", decimals: 2 },
  { key: "kind", name: "Kind", type: "select", options: ["In", "Out"] },
  { key: "paid", name: "Paid", type: "checkbox" },
];
const row = (id: string, data: Record<string, string | number | boolean>) => ({
  id,
  data,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});
const ROWS = [
  row("1", { date: "2026-01-05", what: "Domain, yearly", amount: -14.99, kind: "Out", paid: true }),
  row("2", { date: "2026-02-11", what: 'Invoice "A"', amount: 2400, kind: "In" }),
  row("3", { date: "2026-03-01", what: "Train", amount: -58, kind: "Out", paid: false }),
];

test("readColumns keeps well-formed columns and drops the rest", () => {
  assert.deepEqual(
    readColumns([
      { key: "date", name: "Date", type: "date" },
      { key: "amount", type: "number", decimals: 2.7 },
      { key: "currency", name: "Currency", type: "select", options: ["EUR", 3] },
      { key: "date", name: "Again", type: "text" },
      { key: "", name: "Nameless", type: "text" },
      { key: "odd", name: "Odd", type: "interval" },
      { key: "wide", name: "Wide", type: "text", width: 240.4 },
      { key: "thin", name: "Thin", type: "text", width: 3 },
      "not a column",
    ]),
    [
      { key: "date", name: "Date", type: "date" },
      { key: "amount", name: "amount", type: "number", decimals: 2 },
      { key: "currency", name: "Currency", type: "select", options: ["EUR"] },
      { key: "wide", name: "Wide", type: "text", width: 240 },
      { key: "thin", name: "Thin", type: "text" },
    ],
  );
  assert.deepEqual(readColumns("[]"), []);
});

test("columnKey makes a snake_case key that is not taken", () => {
  assert.equal(columnKey("Amount (EUR)"), "amount_eur");
  assert.equal(columnKey("Déjà vu"), "deja_vu");
  assert.equal(columnKey(""), "column");
  assert.equal(columnKey("Date", ["date", "date_2"]), "date_3");
});

test("toCell reads what was typed as the column's type", () => {
  const of = (type: Column["type"]) => ({ key: "k", name: "K", type });
  assert.equal(toCell(of("number"), " 14.99 "), 14.99);
  assert.equal(toCell(of("number"), "abc"), null);
  assert.equal(toCell(of("number"), "  "), null);
  assert.equal(toCell(of("url"), "https://example.com/r/1"), "https://example.com/r/1");
  assert.equal(toCell(of("url"), "javascript:alert(1)"), null);
  assert.equal(toCell(of("date"), "2026-03-01"), "2026-03-01");
  assert.equal(toCell(of("date"), "March"), null);
  assert.equal(toCell(of("checkbox"), "true"), true);
  assert.equal(toCell(of("checkbox"), false), false);
  assert.equal(toCell(of("text"), 12), "12");
  assert.equal(toCell(of("select"), null), null);
});

test("passes narrows rows by text, choice, tick and date range", () => {
  const none = { query: "", choices: {}, ticked: {}, from: {}, to: {} };
  const ids = (f: Partial<typeof none>) =>
    ROWS.filter((r) => passes(COLUMNS, { ...none, ...f }, r)).map((r) => r.id);
  assert.deepEqual(ids({ query: "domain" }), ["1"]);
  assert.deepEqual(ids({ query: "2,400" }), ["2"]);
  assert.deepEqual(ids({ choices: { kind: ["Out"] } }), ["1", "3"]);
  assert.deepEqual(ids({ ticked: { paid: true } }), ["1"]);
  assert.deepEqual(ids({ from: { date: "2026-02-01" } }), ["2", "3"]);
  assert.deepEqual(ids({ from: { date: "2026-02-01" }, to: { date: "2026-02-28" } }), ["2"]);
  assert.deepEqual(ids({ choices: { kind: ["Out"] }, ticked: { paid: true } }), ["1"]);
});

test("total adds a number column without float noise", () => {
  assert.equal(total(ROWS, "amount"), 2327.01);
  assert.equal(total([row("a", { amount: 0.1 }), row("b", { amount: 0.2 })], "amount"), 0.3);
});

test("toCsv writes the names, then the cells as stored, quoted where RFC 4180 asks", () => {
  assert.equal(
    toCsv(COLUMNS, ROWS),
    "Date,What,Amount,Kind,Paid\r\n" +
      '2026-01-05,"Domain, yearly",-14.99,Out,true\r\n' +
      '2026-02-11,"Invoice ""A""",2400,In,\r\n' +
      "2026-03-01,Train,-58,Out,false\r\n",
  );
  assert.equal(csvFileName("Taxes: 2026/Q1"), "Taxes 2026 Q1.csv");
});

test("moveItem puts an item where it was dropped", () => {
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 1, 1), ["a", "b", "c", "d"]);
});
