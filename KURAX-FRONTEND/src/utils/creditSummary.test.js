import assert from "node:assert/strict";
import test from "node:test";
import { buildCreditChartData, filterCreditsForStaff, summarizeCredits } from "./creditSummary.js";

test("filters credits by normalized owner name with a requester fallback", () => {
  const credits = [
    { waiter_name: " Shadia ", amount: 10 },
    { waiter_name: null, requested_by: "SHADIA", amount: 20 },
    { waiter_name: "Other Staff", amount: 30 },
  ];

  assert.deepEqual(filterCreditsForStaff(credits, "shadia"), credits.slice(0, 2));
  assert.deepEqual(filterCreditsForStaff(credits, ""), []);
});

test("matches linked staff IDs and falls back to names for unlinked credits", () => {
  const credits = [
    { owner_staff_id: 12, owner_name: "Another Name", amount: 10 },
    { owner_staff_id: "15", owner_name: "Different Name", amount: 20 },
    { owner_name: " Shadia ", amount: 30 },
  ];

  assert.deepEqual(filterCreditsForStaff(credits, "shadia", 12), [credits[0], credits[2]]);
  assert.deepEqual(filterCreditsForStaff(credits, "shadia", 15), [credits[1], credits[2]]);
  assert.deepEqual(filterCreditsForStaff(credits, "another name"), [credits[0]]);
});

test("summarizes all credit dates and keeps unpaid balances outstanding", () => {
  const summary = summarizeCredits([
    { status: "PendingCashier", amount: 100, balance: 100, business_date: "2026-11-27" },
    { status: "PendingManagerApproval", amount: 200, balance: 200 },
    { status: "Approved", amount: 80, balance: 80 },
    { status: "PartiallySettled", amount: 70, amount_paid: 20, balance: 50 },
    { status: "FullySettled", amount: 40, amount_paid: 40 },
    { status: "Rejected", amount: 30 },
  ]);

  assert.deepEqual(summary, {
    settled: { count: 2, amount: 60 },
    outstanding: { count: 4, amount: 430 },
    total: 6,
    totalAmount: 520,
  });
});

test("plots credit repayments on the settlement business date", () => {
  const chart = buildCreditChartData([
    {
      business_date: "2026-11-24",
      amount: 30000,
      amount_paid: 30000,
      balance: 0,
      status: "FullySettled",
      settlements: [{ amount_paid: 30000, business_date: "2026-11-28" }],
    },
  ], "2026-11-28");

  assert.equal(chart.find(day => day.date === "28 Nov").Settled, 30000);
  assert.equal(chart.find(day => day.date === "24 Nov").Settled, 0);
});
