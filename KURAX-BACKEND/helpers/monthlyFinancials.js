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
  const [salesResult, settlementsResult, pettyResult, expensesResult] = await Promise.all([
    pool.query(`
      SELECT
        COALESCE(SUM(o.total), 0) AS gross_sales,
        COALESCE(SUM(CASE WHEN LOWER(o.payment_method) = 'cash' THEN o.total ELSE 0 END), 0) AS cash,
        COALESCE(SUM(CASE WHEN LOWER(o.payment_method) IN ('card', 'visa', 'pos') THEN o.total ELSE 0 END), 0) AS card,
        COALESCE(SUM(CASE WHEN LOWER(o.payment_method) IN ('mtn', 'momo-mtn') THEN o.total ELSE 0 END), 0) AS mtn,
        COALESCE(SUM(CASE WHEN LOWER(o.payment_method) IN ('airtel', 'momo-airtel') THEN o.total ELSE 0 END), 0) AS airtel,
        COUNT(*) AS order_count
      FROM orders o
      WHERE TO_CHAR(COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1
        AND (o.is_archived = true OR LOWER(o.status) IN ('paid', 'closed', 'confirmed', 'served'))
        AND o.payment_confirmed = true
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
  ]);

  const sales = salesResult.rows[0];
  const settlementBreakdown = settlementsResult.rows[0];
  const pettyOut = Number(pettyResult.rows[0].total);
  const fixedTotal = expensesResult.rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const financials = calculateMonthlyFinancials({
    grossSales: sales.gross_sales,
    creditSettlements: settlementBreakdown.credit_settlements,
    expenses: pettyOut + fixedTotal,
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
    fixedItems: expensesResult.rows,
  };
}
