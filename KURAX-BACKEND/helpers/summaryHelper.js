// helpers/summaryHelper.js
import pool from '../db.js';

/**
 * updateDailySummary
 * Upserts into daily_summary for the given date.
 *
 * @param {Object} params
 * @param {number} params.amount                - Payment amount
 * @param {string} params.method                - Cash | Card | Momo-MTN | Momo-Airtel | Credit | Mixed
 * @param {string} [params.date]                - YYYY-MM-DD (defaults to today Kampala time)
 * @param {number} [params.orderCount]          - Orders to add to count (default 1)
 * @param {boolean} [params.is_credit_settlement] - TRUE when a client is repaying a credit.
 *                                                  Increments total_settled_credits only.
 *                                                  NEVER touches gross, cash, card, or momo totals.
 */
export async function updateDailySummary({ amount, method, date, orderCount = 1, is_credit_settlement = false }) {
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

  // ─────────────────────────────────────────────────────────────────────────────
  // CREDIT SETTLEMENT PATH
  // A client paying off an existing credit is NOT a new sale.
  // It must NEVER increment gross, cash, card, or momo columns.
  // It only increments total_settled_credits so the frontend can show it
  // separately in the GrossRevenueCard as "Credits Settled Today".
  // ─────────────────────────────────────────────────────────────────────────────
  if (is_credit_settlement) {
    try {
      await pool.query(
        `INSERT INTO daily_summary
           (summary_date, total_gross, total_cash, total_card, total_mtn, total_airtel, total_credit, total_mixed, total_settled_credits, order_count, updated_at)
         VALUES ($1, 0, 0, 0, 0, 0, 0, 0, $2, 0, NOW())
         ON CONFLICT (summary_date) DO UPDATE SET
           total_settled_credits = daily_summary.total_settled_credits + EXCLUDED.total_settled_credits,
           updated_at            = NOW()`,
        [summaryDate, amt]
      );
      console.log(`✅ Credit settlement of UGX ${amt} recorded in total_settled_credits only (gross/cash untouched)`);
    } catch (err) {
      console.error('⚠️ Summary update (credit settlement) failed (non-fatal):', err.message);
    }
    return; // ← exit early, do NOT fall through to the regular sale logic below
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REGULAR SALE PATH (cash / card / momo / mixed / new credit IOU)
  // ─────────────────────────────────────────────────────────────────────────────
  const isCash   = m === 'cash';
  const isCard   = m === 'card' || m === 'visa' || m === 'pos';
  const isMTN    = m === 'momo-mtn';
  const isAirtel = m === 'momo-airtel';
  const isCredit = m === 'credit';
  const isMixed  = m === 'mixed';

  // Credits are IOUs — they NEVER count toward gross revenue.
  // Gross only includes money the business has physically received.
  const grossAmt = isCredit ? 0 : amt;

  try {
    await pool.query(
      `INSERT INTO daily_summary
         (summary_date, total_gross, total_cash, total_card, total_mtn, total_airtel, total_credit, total_mixed, total_settled_credits, order_count, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, NOW())
       ON CONFLICT (summary_date) DO UPDATE SET
         total_gross           = daily_summary.total_gross           + EXCLUDED.total_gross,
         total_cash            = daily_summary.total_cash            + EXCLUDED.total_cash,
         total_card            = daily_summary.total_card            + EXCLUDED.total_card,
         total_mtn             = daily_summary.total_mtn             + EXCLUDED.total_mtn,
         total_airtel          = daily_summary.total_airtel          + EXCLUDED.total_airtel,
         total_credit          = daily_summary.total_credit          + EXCLUDED.total_credit,
         total_mixed           = daily_summary.total_mixed           + EXCLUDED.total_mixed,
         order_count           = daily_summary.order_count           + EXCLUDED.order_count,
         updated_at            = NOW()`,
      [
        summaryDate,
        grossAmt,           
        isCash   ? amt : 0,
        isCard   ? amt : 0,
        isMTN    ? amt : 0,
        isAirtel ? amt : 0,
        isCredit ? amt : 0, 
        isMixed  ? amt : 0,
        orderCount,
      ]
    );
  } catch (err) {
    console.error('Summary update failed (non-fatal):', err.message);
  }
}