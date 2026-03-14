// helpers/summaryHelper.js
import pool from '../db.js';

/**
 * updateDailySummary
 * Upserts into daily_summaries for the given date.
 *
 * @param {Object} params
 * @param {number} params.amount        - Payment amount
 * @param {string} params.method        - Cash | Card | Momo-MTN | Momo-Airtel | Credit | Mixed
 * @param {string} [params.date]        - YYYY-MM-DD (defaults to today Kampala time)
 * @param {number} [params.orderCount]  - Orders to add to count (default 1)
 */
export async function updateDailySummary({ amount, method, date, orderCount = 1 }) {
  const summaryDate = date || (() => {
    const kampala = new Date(Date.now() + 3 * 60 * 60 * 1000);
    return [
      kampala.getUTCFullYear(),
      String(kampala.getUTCMonth() + 1).padStart(2, '0'),
      String(kampala.getUTCDate()).padStart(2, '0'),
    ].join('-');
  })();

  const amt = Number(amount) || 0;
  const m   = (method || '').toLowerCase();

  const isCash   = m === 'cash';
  const isCard   = m === 'card' || m === 'visa' || m === 'pos';
  const isMTN    = m === 'momo-mtn';
  const isAirtel = m === 'momo-airtel';
  const isCredit = m === 'credit';
  const isMixed  = m === 'mixed';

  // ✅ Credits are IOUs — they NEVER count toward gross revenue.
  // Gross only includes money the business has physically received.
  const grossAmt = isCredit ? 0 : amt;

  try {
    await pool.query(
      `INSERT INTO daily_summaries
         (summary_date, total_gross, total_cash, total_card, total_mtn, total_airtel, total_credit, total_mixed, order_count, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (summary_date) DO UPDATE SET
         total_gross   = daily_summaries.total_gross   + EXCLUDED.total_gross,
         total_cash    = daily_summaries.total_cash    + EXCLUDED.total_cash,
         total_card    = daily_summaries.total_card    + EXCLUDED.total_card,
         total_mtn     = daily_summaries.total_mtn     + EXCLUDED.total_mtn,
         total_airtel  = daily_summaries.total_airtel  + EXCLUDED.total_airtel,
         total_credit  = daily_summaries.total_credit  + EXCLUDED.total_credit,
         total_mixed   = daily_summaries.total_mixed   + EXCLUDED.total_mixed,
         order_count   = daily_summaries.order_count   + EXCLUDED.order_count,
         updated_at    = NOW()`,
      [
        summaryDate,
        grossAmt,          // ✅ 0 for credits, real amount for everything else
        isCash   ? amt : 0,
        isCard   ? amt : 0,
        isMTN    ? amt : 0,
        isAirtel ? amt : 0,
        isCredit ? amt : 0, // tracked separately for visibility
        isMixed  ? amt : 0,
        orderCount,
      ]
    );
  } catch (err) {
    console.error('⚠️ Summary update failed (non-fatal):', err.message);
  }
}