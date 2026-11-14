import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMonthlyFinancials, getMonthlyFinancials } from '../helpers/monthlyFinancials.js';

test('monthly sales include paid public website orders even while fulfillment is pending', async () => {
  const queries = [];
  const fakePool = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes('AS gross_sales')) {
        return {
          rows: [{
            gross_sales: '24000',
            collected_sales: '24000',
            cash: '0',
            card: '0',
            mtn: '24000',
            airtel: '0',
            complimentary_paid: '0',
            complimentary_waived: '0',
            order_count: '1',
          }],
        };
      }
      if (sql.includes('AS complimentary_paid')) {
        return { rows: [{ complimentary_paid: '0', complimentary_waived: '0' }] };
      }
      if (sql.includes('AS credit_settlements')) {
        return { rows: [{ credit_settlements: '0', cash: '0', card: '0', mtn: '0', airtel: '0', settlement_count: '0' }] };
      }
      if (sql.includes('AS total')) return { rows: [{ total: '0' }] };
      if (sql.includes('monthly_expenses')) return { rows: [] };
      return { rows: [{ total: '0' }] };
    },
  };

  const financials = await getMonthlyFinancials(fakePool, '2026-10');

  assert.match(queries[0], /o\.public_order_ref IS NOT NULL/);
  assert.equal(financials.grossSales, 24000);
  assert.equal(financials.totalCollected, 24000);
  assert.equal(financials.salesBreakdown.mtn, 24000);
  assert.equal(financials.orderCount, 1);
});

test('a UGX 150000 item with a UGX 50000 waiver reports gross sales of UGX 150000 and collections of UGX 100000', async () => {
  const queries = [];
  const fakePool = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes('AS gross_sales')) {
        return {
          rows: [{
            gross_sales: '150000',
            collected_sales: '100000',
            cash: '0',
            card: '0',
            mtn: '100000',
            airtel: '0',
            complimentary_paid: '100000',
            complimentary_waived: '50000',
            order_count: '1',
          }],
        };
      }
      if (sql.includes('AS complimentary_paid')) {
        return { rows: [{ complimentary_paid: '100000', complimentary_waived: '50000' }] };
      }
      if (sql.includes('AS credit_settlements')) {
        return { rows: [{ credit_settlements: '0', cash: '0', card: '0', mtn: '0', airtel: '0', settlement_count: '0' }] };
      }
      if (sql.includes('FROM petty_cash')) return { rows: [{ total: '5000' }] };
      if (sql.includes('AS total')) return { rows: [{ total: '0' }] };
      if (sql.includes('monthly_expenses')) return { rows: [] };
      return { rows: [{ total: '0' }] };
    },
  };

  const financials = await getMonthlyFinancials(fakePool, '2026-10');

  assert.match(queries[0], /originalLineAmount/);
  assert.match(queries[0], /payableAmount/);
  assert.doesNotMatch(queries[0], /BOOL_OR\(COALESCE\(item->>'complimentary'/);
  assert.equal(financials.grossSales, 150000);
  assert.equal(financials.collectedSales, 100000);
  assert.equal(financials.totalCollected, 100000);
  assert.equal(financials.complimentaryPaid, 100000);
  assert.equal(financials.complimentaryWaived, 50000);
  assert.equal(financials.currentCash, 95000);
  assert.match(queries[1], /AS complimentary_paid/);
  assert.match(queries[1], /AS complimentary_waived/);
  assert.match(queries[1], /o\.original_order_ids/);
  assert.match(queries[1], /complimentaryWaivedAmount/);
});

test('monthly financial totals use collected sales for cash, not gross sales', () => {
  const financials = calculateMonthlyFinancials({
    grossSales: 49000,
    collectedSales: 24000,
    creditSettlements: 1000,
    expenses: 5000,
  });

  assert.equal(financials.grossSales, 49000);
  assert.equal(financials.currentCash, 20000);
});
