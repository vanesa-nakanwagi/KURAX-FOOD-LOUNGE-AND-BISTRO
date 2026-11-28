import {
  orderItemGrossAmountSql,
  orderItemPayableAmountSql,
} from './orderItemSalesAmounts.js';

export function calculateMonthlyFinancials({ grossSales = 0, collectedSales = grossSales, creditSettlements = 0, expenses = 0 } = {}) {
  const gross = Number(grossSales) || 0;
  const collected = Number(collectedSales) || 0;
  const settlements = Number(creditSettlements) || 0;
  const totalExpenses = Number(expenses) || 0;

  return {
    grossSales: gross,
    collectedSales: collected,
    creditSettlements: settlements,
    expenses: totalExpenses,
    currentCash: collected + settlements - totalExpenses,
  };
}

export async function getMonthlyFinancials(pool, month) {
  const [salesResult, complimentaryResult, settlementsResult, pettyResult, expensesResult, cashierExpensesResult, creditBalanceResult] = await Promise.all([
    pool.query(`
      SELECT
        COALESCE(SUM(main_items.gross_total), 0) AS gross_sales,
        COALESCE(SUM(main_items.total), 0) AS collected_sales,
        COALESCE(SUM(CASE WHEN LOWER(o.payment_method) = 'cash' THEN main_items.total ELSE 0 END), 0) AS cash,
        COALESCE(SUM(CASE WHEN LOWER(o.payment_method) IN ('card', 'visa', 'pos') THEN main_items.total ELSE 0 END), 0) AS card,
        COALESCE(SUM(CASE WHEN LOWER(o.payment_method) IN ('mtn', 'momo-mtn') THEN main_items.total ELSE 0 END), 0) AS mtn,
        COALESCE(SUM(CASE WHEN LOWER(o.payment_method) IN ('airtel', 'momo-airtel') THEN main_items.total ELSE 0 END), 0) AS airtel,
        COUNT(*) AS order_count
      FROM orders o
      CROSS JOIN LATERAL (
        SELECT
          CASE WHEN jsonb_array_length(COALESCE(o.items, '[]'::jsonb)) = 0 THEN COALESCE(o.total, 0)
            ELSE COALESCE(SUM(${orderItemPayableAmountSql('item')}), 0)
          END AS total,
          CASE WHEN jsonb_array_length(COALESCE(o.items, '[]'::jsonb)) = 0 THEN COALESCE(o.total, 0)
            ELSE COALESCE(SUM(${orderItemGrossAmountSql('item')}), 0)
          END AS gross_total
        FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS order_items(item)
        WHERE LOWER(COALESCE(item->>'station','')) <> 'shisha'
      ) main_items
      WHERE TO_CHAR(COALESCE(o.business_date, DATE(COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Nairobi'))::timestamp, 'YYYY-MM') = $1
        AND (
          o.public_order_ref IS NOT NULL
          OR o.is_archived = true
          OR LOWER(o.status) IN ('paid', 'closed', 'confirmed', 'served')
        )
        AND o.payment_confirmed = true
        AND main_items.gross_total > 0
        AND UPPER(COALESCE(o.payment_method, '')) NOT LIKE '%CREDIT%'
        AND NOT EXISTS (
          SELECT 1 FROM orders o2
          WHERE o2.original_order_ids IS NOT NULL
            AND o2.original_order_ids::text LIKE '%' || o.id::text || '%'
        )
    `, [month]),
    pool.query(`
      SELECT
        COALESCE(SUM(CASE
          WHEN COALESCE(item->>'complimentary', 'false') = 'true'
            AND (
              COALESCE(item->>'_rowPaid', 'false') = 'true'
              OR COALESCE(item->>'is_partially_paid', 'false') = 'true'
            )
          THEN LEAST(
            ${orderItemPayableAmountSql('item')},
            GREATEST(COALESCE(
              NULLIF(item->>'paidAmount', '')::numeric,
              NULLIF(item->>'partial_amount_paid', '')::numeric,
              NULLIF(item->>'amount_paid', '')::numeric,
              0
            ), 0)
          )
          ELSE 0
        END), 0) AS complimentary_paid,
        COALESCE(SUM(CASE
          WHEN COALESCE(item->>'complimentary', 'false') = 'true'
          THEN GREATEST(COALESCE(NULLIF(item->>'complimentaryWaivedAmount', '')::numeric, 0), 0)
          ELSE 0
        END), 0) AS complimentary_waived
      FROM orders o
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS order_items(item)
      WHERE TO_CHAR(COALESCE(o.business_date, DATE(COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Nairobi'))::timestamp, 'YYYY-MM') = $1
        AND COALESCE(jsonb_array_length(o.original_order_ids), 0) = 0
        AND LOWER(COALESCE(item->>'station','')) <> 'shisha'
    `, [month]),
    pool.query(`
      SELECT
        COALESCE(SUM(cs.amount_paid), 0) AS credit_settlements,
        COALESCE(SUM(CASE WHEN LOWER(cs.method) = 'cash' THEN cs.amount_paid ELSE 0 END), 0) AS cash,
        COALESCE(SUM(CASE WHEN LOWER(cs.method) IN ('card', 'visa', 'pos') THEN cs.amount_paid ELSE 0 END), 0) AS card,
        COALESCE(SUM(CASE WHEN LOWER(cs.method) IN ('mtn', 'momo-mtn') THEN cs.amount_paid ELSE 0 END), 0) AS mtn,
        COALESCE(SUM(CASE WHEN LOWER(cs.method) IN ('airtel', 'momo-airtel') THEN cs.amount_paid ELSE 0 END), 0) AS airtel,
        COUNT(*) AS settlement_count
      FROM credit_settlements cs
      JOIN credits c ON c.id = cs.credit_id
      WHERE TO_CHAR(COALESCE(cs.business_date, DATE(cs.created_at AT TIME ZONE 'Africa/Nairobi'))::timestamp, 'YYYY-MM') = $1
        AND c.status IN ('FullySettled', 'PartiallySettled')
    `, [month]),
    pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM petty_cash
      WHERE direction = 'OUT' AND TO_CHAR(entry_date, 'YYYY-MM') = $1
    `, [month]),
    pool.query(`SELECT * FROM monthly_expenses WHERE month = $1`, [month]),
    pool.query(`
      SELECT COALESCE(SUM(line.debit - line.credit), 0) AS total
      FROM public.journal_entries entry
      JOIN public.general_ledger line ON line.journal_entry_id = entry.id
      JOIN public.chart_of_accounts account ON account.code = line.account_code
      WHERE entry.system_type = 'MAIN' AND account.category = 'Expense'
        AND (
          entry.source_transaction LIKE 'cashier_expense:%'
          OR entry.reversal_of IN (
            SELECT id FROM public.journal_entries WHERE source_transaction LIKE 'cashier_expense:%'
          )
        )
        AND TO_CHAR(entry.entry_date, 'YYYY-MM') = $1
    `, [month]),
    pool.query(`
      SELECT COALESCE(SUM(GREATEST(
        COALESCE(c.amount, 0) - CASE
          WHEN EXISTS (
            SELECT 1 FROM credit_settlements any_settlement
            WHERE any_settlement.credit_id = c.id
          )
          THEN COALESCE((
            SELECT SUM(month_settlement.amount_paid)
            FROM credit_settlements month_settlement
            WHERE month_settlement.credit_id = c.id
              AND COALESCE(month_settlement.business_date, (month_settlement.created_at AT TIME ZONE 'Africa/Kampala')::date)
                < (DATE_TRUNC('month', ($1 || '-01')::date) + INTERVAL '1 month')::date
          ), 0)
          ELSE COALESCE(c.amount_paid, 0)
        END,
        0
      )), 0) AS credit_balance
      FROM credits c
      WHERE TO_CHAR(COALESCE(c.business_date, (c.created_at AT TIME ZONE 'Africa/Kampala')::date)::timestamp, 'YYYY-MM') = $1
        AND UPPER(c.status) IN ('APPROVED', 'PARTIALLYSETTLED', 'FULLYSETTLED')
    `, [month]),
  ]);

  const sales = salesResult.rows[0];
  const settlementBreakdown = settlementsResult.rows[0];
  const pettyOut = Number(pettyResult.rows[0].total);
  const fixedTotal = expensesResult.rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const cashierExpenseTotal = Number(cashierExpensesResult.rows[0].total) || 0;
  const financials = calculateMonthlyFinancials({
    grossSales: sales.gross_sales,
    collectedSales: sales.collected_sales ?? sales.gross_sales,
    creditSettlements: settlementBreakdown.credit_settlements,
    expenses: pettyOut + fixedTotal + cashierExpenseTotal,
  });

  return {
    ...financials,
    totalCollected: financials.collectedSales + financials.creditSettlements,
    orderCount: Number(sales.order_count),
    complimentaryPaid: Number(complimentaryResult.rows[0].complimentary_paid) || 0,
    complimentaryWaived: Number(complimentaryResult.rows[0].complimentary_waived) || 0,
    creditBalance: Number(creditBalanceResult.rows[0].credit_balance) || 0,
    settlementCount: Number(settlementBreakdown.settlement_count),
    salesBreakdown: {
      cash: Number(sales.cash),
      card: Number(sales.card),
      mtn: Number(sales.mtn),
      airtel: Number(sales.airtel),
    },
    settlementBreakdown: {
      cash: Number(settlementBreakdown.cash),
      card: Number(settlementBreakdown.card),
      mtn: Number(settlementBreakdown.mtn),
      airtel: Number(settlementBreakdown.airtel),
    },
    pettyOut,
    fixedTotal,
    cashierExpenseTotal,
    fixedItems: expensesResult.rows,
  };
}
