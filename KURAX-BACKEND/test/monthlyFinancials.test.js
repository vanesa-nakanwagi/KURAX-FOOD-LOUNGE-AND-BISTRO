import test from 'node:test';
import assert from 'node:assert/strict';
import { getMonthlyFinancials } from '../helpers/monthlyFinancials.js';

test('monthly sales include paid public website orders even while fulfillment is pending', async () => {
  const queries = [];
  const fakePool = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes('AS gross_sales')) {
        return {
          rows: [{
            gross_sales: '24000',
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
