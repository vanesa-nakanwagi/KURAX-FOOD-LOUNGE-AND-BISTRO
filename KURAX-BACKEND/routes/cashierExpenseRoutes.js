import { randomBytes } from 'node:crypto';
import express from 'express';
import pool from '../db.js';
import { createExpenseJournalEntry, reverseJournalEntry } from '../helpers/accounting.js';
import { resolveNotificationUser } from '../middleware/notificationAuth.js';
import logActivity from '../utils/logsActivity.js';

const router = express.Router();

function kampalaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}-${parts.find((part) => part.type === 'day').value}`;
}

async function requireCashier(req, res, next) {
  const staff = await resolveNotificationUser(req);
  if (!staff) return res.status(401).json({ error: 'Staff sign-in is required.' });
  if (staff.scope !== 'restaurant' || String(staff.role).toUpperCase() !== 'CASHIER') {
    return res.status(403).json({ error: 'Cashier access is required.' });
  }
  req.cashier = staff;
  return next();
}

router.use(requireCashier);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        entry.id,
        entry.reference,
        entry.entry_date,
        entry.description,
        entry.posted_by,
        entry.status,
        COALESCE(SUM(line.debit), 0) AS amount,
        reversal.id AS reversal_id,
        reversal.reference AS reversal_reference,
        reversal.reversal_reason,
        reversal.posted_by AS reversed_by
      FROM public.journal_entries entry
      JOIN public.general_ledger line ON line.journal_entry_id = entry.id
      LEFT JOIN public.journal_entries reversal ON reversal.reversal_of = entry.id
      WHERE entry.source_transaction LIKE 'cashier_expense:%'
      GROUP BY entry.id, reversal.id
      ORDER BY entry.entry_date DESC, entry.id DESC
      LIMIT 100
    `);
    res.json({ entries: result.rows });
  } catch (error) {
    console.error('Cashier expense lookup failed:', error.message);
    res.status(500).json({ error: 'Could not load cashier expenses.' });
  }
});

router.post('/', async (req, res) => {
  const category = String(req.body.category || '').trim().slice(0, 100);
  const description = String(req.body.description || '').trim().slice(0, 500);
  const amount = Math.round(Number(req.body.amount) * 100) / 100;
  const paymentMethod = String(req.body.payment_method || 'Cash').trim();
  const paymentAccounts = {
    Cash: '1001',
    'Momo-MTN': '1003',
    'Momo-Airtel': '1003',
    Card: '1002',
  };

  if (!category || !description || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Category, description, and a positive amount are required.' });
  }
  if (!Object.hasOwn(paymentAccounts, paymentMethod)) {
    return res.status(400).json({ error: 'Choose a valid payment source.' });
  }

  const actor = req.cashier.name;
  const reference = `CEXP-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  try {
    const journal = await createExpenseJournalEntry({
      amount,
      category,
      description: `${category}: ${description}`,
      paymentAccountCode: paymentAccounts[paymentMethod],
      sourceTransaction: `cashier_expense:${reference}`,
      postedBy: actor,
      entryDate: kampalaDate(),
    });
    await logActivity(pool, {
      type: 'ACCOUNTING_EXPENSE',
      actor,
      role: 'CASHIER',
      message: `Cashier expense recorded: UGX ${amount.toLocaleString()} (${category}: ${description})`,
      meta: { journal_entry_id: journal.id, reference: journal.reference, payment_method: paymentMethod },
    });
    return res.status(201).json({ success: true, id: journal.id, reference: journal.reference });
  } catch (error) {
    console.error('Cashier expense posting failed:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Could not record this expense.' });
  }
});

router.post('/:id/reverse', async (req, res) => {
  const journalEntryId = Number(req.params.id);
  if (!Number.isInteger(journalEntryId) || journalEntryId < 1) {
    return res.status(400).json({ error: 'A valid expense entry is required.' });
  }

  try {
    const originalResult = await pool.query(
      `SELECT id, reference FROM public.journal_entries
       WHERE id = $1 AND source_transaction LIKE 'cashier_expense:%'`,
      [journalEntryId]
    );
    const original = originalResult.rows[0];
    if (!original) return res.status(404).json({ error: 'Cashier expense not found.' });

    const result = await reverseJournalEntry({
      journalEntryId,
      reversalDate: kampalaDate(),
      reason: req.body.reason,
      actor: req.cashier.name,
    });
    await logActivity(pool, {
      type: 'ACCOUNTING_EXPENSE',
      actor: req.cashier.name,
      role: 'CASHIER',
      message: `Cashier expense reversed: ${original.reference} (${String(req.body.reason || '').trim()})`,
      meta: { journal_entry_id: journalEntryId, reversal_id: result.reversal.id, reversal_reference: result.reversal.reference },
    });
    return res.json({ success: true, reversal: result.reversal });
  } catch (error) {
    console.error('Cashier expense reversal failed:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Could not reverse this expense.' });
  }
});

export default router;
