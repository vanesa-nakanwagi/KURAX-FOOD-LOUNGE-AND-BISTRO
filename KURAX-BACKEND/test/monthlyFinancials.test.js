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
            order_count: '1',
          }],
        };
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

test('complimentary items remain in gross sales but are excluded from collected sales', async () => {
  const queries = [];
  const fakePool = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes('AS gross_sales')) {
        return {
          rows: [{
            gross_sales: '49000',
            collected_sales: '24000',
            cash: '0',
            card: '0',
            mtn: '24000',
            airtel: '0',
            order_count: '1',
          }],
        };
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
  assert.match(queries[0], /complimentaryWaivedAmount/);
  assert.equal(financials.grossSales, 49000);
  assert.equal(financials.collectedSales, 24000);
  assert.equal(financials.totalCollected, 24000);
  assert.equal(financials.currentCash, 19000);
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
