import pool from '../db.js';
import { getLiveBusinessDate, isValidBusinessDate } from './businessDateFormat.js';

export { getLiveBusinessDate, isValidBusinessDate };

export async function getSystemBusinessContext() {
  const result = await pool.query(
    `SELECT business_date::text AS business_date, updated_by, updated_at
     FROM public.system_business_context
     WHERE id = 1`
  );
  const liveDate = getLiveBusinessDate();
  const businessDate = result.rows[0]?.business_date || liveDate;
  return {
    businessDate,
    liveDate,
    mode: businessDate < liveDate ? 'HISTORICAL' : 'LIVE',
    updatedBy: result.rows[0]?.updated_by || null,
    updatedAt: result.rows[0]?.updated_at || null,
  };
}

export async function setSystemBusinessDate(date, updatedBy) {
  const liveDate = getLiveBusinessDate();
  if (date !== null && (!isValidBusinessDate(date) || date > liveDate)) {
    const error = new Error('Choose a valid business date that is not in the future.');
    error.statusCode = 400;
    throw error;
  }

  const storedDate = date === liveDate ? null : date;
  await pool.query(
    `UPDATE public.system_business_context
     SET business_date = $1, updated_by = $2, updated_at = NOW()
     WHERE id = 1`,
    [storedDate, updatedBy]
  );
  return getSystemBusinessContext();
}
