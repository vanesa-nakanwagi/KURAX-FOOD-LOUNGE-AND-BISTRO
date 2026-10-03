export async function getCounterCash(db, date) {
  const result = await db.query(
    `SELECT
       COALESCE(
         (SELECT CASE WHEN ds.day_closed THEN COALESCE(dc.cash, ds.total_cash, 0) ELSE ds.total_cash END
          FROM daily_summary ds
          LEFT JOIN day_closings dc ON dc.closing_date = ds.summary_date
          WHERE ds.summary_date = $1),
         (SELECT cash FROM day_closings WHERE closing_date = $1),
         0
       ) AS cash_sales,
       COALESCE((SELECT SUM(amount) FROM petty_cash WHERE entry_date = $1 AND direction = 'OUT'), 0) AS petty_expenses`,
    [date]
  );
  const cashSales = Number(result.rows[0].cash_sales) || 0;
  const pettyExpenses = Number(result.rows[0].petty_expenses) || 0;
  return { cashSales, pettyExpenses, cashOnCounter: cashSales - pettyExpenses };
}

export async function createPettyExpense(db, entry) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO daily_summary (summary_date, total_cash)
       VALUES ($1, 0) ON CONFLICT (summary_date) DO NOTHING`,
      [entry.entry_date]
    );
    const summary = await client.query(
      `SELECT total_cash, day_closed FROM daily_summary WHERE summary_date = $1 FOR UPDATE`,
      [entry.entry_date]
    );
    if (summary.rows[0].day_closed) {
      const error = new Error('Cannot record an expense for a closed day');
      error.status = 400;
      throw error;
    }
    const expenses = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM petty_cash WHERE entry_date = $1 AND direction = 'OUT'`,
      [entry.entry_date]
    );
    const cashBefore = (Number(summary.rows[0].total_cash) || 0) - (Number(expenses.rows[0].total) || 0);
    if (entry.amount > cashBefore) {
      const error = new Error('Petty expense exceeds the available counter cash');
      error.status = 400;
      throw error;
    }
    const result = await client.query(
      `INSERT INTO petty_cash (entry_date, amount, direction, category, description, logged_by)
       VALUES ($1, $2, 'OUT', $3, $4, $5) RETURNING *`,
      [entry.entry_date, entry.amount, entry.category, entry.description, entry.logged_by]
    );
    await client.query('COMMIT');
    return { entry: result.rows[0], cashBefore, cashAfter: cashBefore - entry.amount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePettyExpense(db, id, entry) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT entry_date FROM petty_cash WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!existing.rows.length) {
      const error = new Error('Petty cash entry not found');
      error.status = 404;
      throw error;
    }
    const date = existing.rows[0].entry_date;
    await client.query(
      `INSERT INTO daily_summary (summary_date, total_cash)
       VALUES ($1, 0) ON CONFLICT (summary_date) DO NOTHING`,
      [date]
    );
    const summary = await client.query(
      `SELECT total_cash, day_closed FROM daily_summary WHERE summary_date = $1 FOR UPDATE`,
      [date]
    );
    if (summary.rows[0].day_closed) {
      const error = new Error('Cannot edit an expense for a closed day');
      error.status = 400;
      throw error;
    }
    const expenses = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM petty_cash WHERE entry_date = $1 AND direction = 'OUT' AND id <> $2`,
      [date, id]
    );
    const cashBefore = (Number(summary.rows[0].total_cash) || 0) - (Number(expenses.rows[0].total) || 0);
    if (entry.amount > cashBefore) {
      const error = new Error('Petty expense exceeds the available counter cash');
      error.status = 400;
      throw error;
    }
    const result = await client.query(
      `UPDATE petty_cash
       SET amount = $1, direction = 'OUT', category = $2, description = $3, logged_by = $4
       WHERE id = $5 RETURNING *`,
      [entry.amount, entry.category, entry.description, entry.logged_by, id]
    );
    await client.query('COMMIT');
    return { entry: result.rows[0], cashBefore, cashAfter: cashBefore - entry.amount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}