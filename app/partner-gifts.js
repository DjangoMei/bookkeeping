export const PARTNER_GIFT_BUDGET_CENTS = 500_000;

/** @param {"zcy" | "django"} role */
export function partnerOf(role) {
  return role === "zcy" ? "django" : "zcy";
}

/**
 * A gift belongs to its recipient; it spends the other person's gift budget.
 * @param {Array<{kind: string, owner: string, entryDate: string, amountCents: number}>} entries
 * @param {{start: string, end: string}} cycle
 */
export function summarizePartnerGifts(entries, cycle) {
  const totals = {
    zcy: { spentCents: 0, remainingCents: PARTNER_GIFT_BUDGET_CENTS, overBudgetCents: 0, count: 0 },
    django: { spentCents: 0, remainingCents: PARTNER_GIFT_BUDGET_CENTS, overBudgetCents: 0, count: 0 },
  };
  for (const entry of entries) {
    if (entry.kind !== "partner_gift" || (entry.owner !== "zcy" && entry.owner !== "django")
      || entry.entryDate < cycle.start || entry.entryDate > cycle.end) continue;
    const giver = partnerOf(entry.owner);
    totals[giver].spentCents += entry.amountCents;
    totals[giver].count += 1;
  }
  for (const budget of Object.values(totals)) {
    budget.remainingCents = Math.max(PARTNER_GIFT_BUDGET_CENTS - budget.spentCents, 0);
    budget.overBudgetCents = Math.max(budget.spentCents - PARTNER_GIFT_BUDGET_CENTS, 0);
  }
  return totals;
}
