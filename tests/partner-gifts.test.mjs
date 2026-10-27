import assert from "node:assert/strict";
import test from "node:test";
import { partnerOf, summarizePartnerGifts, PARTNER_GIFT_BUDGET_CENTS } from "../app/partner-gifts.js";

const cycle = { start: "2026-06-01", end: "2027-05-31" };
const gift = (owner, amountCents, entryDate = "2026-10-27") => ({ kind: "partner_gift", owner, amountCents, entryDate });

test("the recipient records a gift that spends the giver's independent 5000 budget", () => {
  const budgets = summarizePartnerGifts([gift("zcy", 123456), gift("django", 45000), { ...gift("django", 999999), kind: "large_expense" }], cycle);
  assert.equal(PARTNER_GIFT_BUDGET_CENTS, 500000);
  assert.equal(partnerOf("zcy"), "django");
  assert.equal(budgets.django.spentCents, 123456);
  assert.equal(budgets.django.remainingCents, 376544);
  assert.equal(budgets.zcy.spentCents, 45000);
  assert.equal(budgets.zcy.remainingCents, 455000);
});

test("gift budgets include both June/May boundaries and reset for the next cycle", () => {
  const records = [gift("zcy", 10, "2026-05-31"), gift("zcy", 20, "2026-06-01"), gift("zcy", 30, "2027-05-31"), gift("zcy", 40, "2027-06-01")];
  assert.equal(summarizePartnerGifts(records, cycle).django.spentCents, 50);
  assert.equal(summarizePartnerGifts(records, { start: "2027-06-01", end: "2028-05-31" }).django.spentCents, 40);
});

test("edits, deletions and overspending recalculate accurately without sharing budgets", () => {
  const budgets = summarizePartnerGifts([gift("zcy", 500001), gift("django", 300)], cycle);
  assert.equal(budgets.django.remainingCents, 0);
  assert.equal(budgets.django.overBudgetCents, 1);
  assert.equal(budgets.zcy.remainingCents, 499700);
  assert.equal(summarizePartnerGifts([gift("zcy", 100)], cycle).django.spentCents, 100);
  assert.equal(summarizePartnerGifts([], cycle).django.remainingCents, 500000);
  assert.equal(summarizePartnerGifts([gift("family", 300)], cycle).zcy.spentCents, 0);
});
