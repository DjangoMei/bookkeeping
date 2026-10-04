import assert from "node:assert/strict";
import test from "node:test";
import { summarizeChildExpenses } from "../app/child-expense-totals.js";

const entries = [
  { kind: "child_expense", entryDate: "2025-12-31", amountCents: 12345, payer: "mother" },
  { kind: "child_expense", entryDate: "2026-01-01", amountCents: 6789, payer: "family" },
  { kind: "child_expense", entryDate: "2026-10-04", amountCents: 101, payer: "mother" },
  { kind: "income", entryDate: "2026-10-04", amountCents: 999999, payer: "family" },
];

test("adds every year of child spending, keeping mother payments as a subset", () => {
  assert.deepEqual(summarizeChildExpenses(entries, "2026"), {
    count: 3, totalCents: 19235, motherCents: 12446, yearCents: 6890, yearMotherCents: 101,
  });
  assert.equal(summarizeChildExpenses(entries, "2027").totalCents, 19235);
  assert.equal(summarizeChildExpenses(entries, "2027").yearCents, 0);
});

test("recomputes after editing or deleting records and handles an empty ledger", () => {
  const edited = entries.map((entry, index) => index === 2 ? { ...entry, amountCents: 201, payer: "family" } : entry);
  assert.equal(summarizeChildExpenses(edited, "2026").totalCents, 19335);
  assert.equal(summarizeChildExpenses(edited, "2026").motherCents, 12345);
  assert.equal(summarizeChildExpenses(entries.slice(1), "2026").totalCents, 6890);
  assert.deepEqual(summarizeChildExpenses([], "2026"), {
    count: 0, totalCents: 0, motherCents: 0, yearCents: 0, yearMotherCents: 0,
  });
});
