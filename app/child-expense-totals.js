/**
 * @param {Array<{kind: string, entryDate: string, amountCents: number, payer: string}>} entries
 * @param {string} year
 */
export function summarizeChildExpenses(entries, year) {
  const totals = { count: 0, totalCents: 0, motherCents: 0, yearCents: 0, yearMotherCents: 0 };
  for (const entry of entries) {
    if (entry.kind !== "child_expense") continue;
    totals.count += 1;
    totals.totalCents += entry.amountCents;
    if (entry.payer === "mother") totals.motherCents += entry.amountCents;
    if (entry.entryDate.startsWith(`${year}-`)) {
      totals.yearCents += entry.amountCents;
      if (entry.payer === "mother") totals.yearMotherCents += entry.amountCents;
    }
  }
  return totals;
}
