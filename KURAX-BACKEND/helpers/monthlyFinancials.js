export function calculateMonthlyFinancials({ grossSales = 0, creditSettlements = 0, expenses = 0 } = {}) {
  const gross = Number(grossSales) || 0;
  const settlements = Number(creditSettlements) || 0;
  const totalExpenses = Number(expenses) || 0;

  return {
    grossSales: gross,
    creditSettlements: settlements,
    expenses: totalExpenses,
    currentCash: gross + settlements - totalExpenses,
  };
}

export async function getMonthlyFinancials(pool, month) {
  const [salesResult, settlementsResult, pettyResult, expensesResult, cashierExpensesResult] = await Promise.all([
    pool.query(`
      SELECT
        COALESCE(SUM(main_items.total), 0) AS gross_sales,
        COALESCE(SUM(CASE WHEN LOWER(o.payment_method) = 'cash' THEN main_items.total ELSE 0 END), 0) AS cash,
        COALESCE(SUM(CASE WHEN LOWER(o.payment_method) IN ('card', 'visa', 'pos') THEN main_items.total ELSE 0 END), 0) AS card,
        COALESCE(SUM(CASE WHEN LOWER(o.payment_method) IN ('mtn', 'momo-mtn') THEN main_items.total ELSE 0 END), 0) AS mtn,
        COALESCE(SUM(CASE WHEN LOWER(o.payment_method) IN ('airtel', 'momo-airtel') THEN main_items.total ELSE 0 END), 0) AS airtel,
        COUNT(*) AS order_count
      FROM orders o
      CROSS JOIN LATERAL (
        SELECT CASE WHEN jsonb_array_length(COALESCE(o.items, '[]'::jsonb)) = 0 THEN COALESCE(o.total, 0)
          ELSE COALESCE(SUM(COALESCE(
            NULLIF(item->>'line_total','')::numeric,
            NULLIF(item->>'lineTotal','')::numeric,
            COALESCE(NULLIF(item->>'price','')::numeric, NULLIF(item->>'unit_price','')::numeric)
              * COALESCE(NULLIF(item->>'quantity','')::numeric,1)
          )),0)
        END AS total
        FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS order_items(item)
        WHERE LOWER(COALESCE(item->>'station','')) <> 'shisha'
      ) main_items
      WHERE TO_CHAR(COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1
        AND (o.is_archived = true OR LOWER(o.status) IN ('paid', 'closed', 'confirmed', 'served'))
        AND o.payment_confirmed = true
        AND main_items.total > 0
        AND UPPER(COALESCE(o.payment_method, '')) NOT LIKE '%CREDIT%'
        AND NOT EXISTS (
          SELECT 1 FROM orders o2
          WHERE o2.original_order_ids IS NOT NULL
            AND o2.original_order_ids::text LIKE '%' || o.id::text || '%'
        )
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
      WHERE TO_CHAR(cs.created_at AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1
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
  ]);

  const sales = salesResult.rows[0];
  const settlementBreakdown = settlementsResult.rows[0];
  const pettyOut = Number(pettyResult.rows[0].total);
  const fixedTotal = expensesResult.rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const cashierExpenseTotal = Number(cashierExpensesResult.rows[0].total) || 0;
  const financials = calculateMonthlyFinancials({
    grossSales: sales.gross_sales,
    creditSettlements: settlementBreakdown.credit_settlements,
    expenses: pettyOut + fixedTotal + cashierExpenseTotal,
  });

  return {
    ...financials,
    totalCollected: financials.grossSales + financials.creditSettlements,
    orderCount: Number(sales.order_count),
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
