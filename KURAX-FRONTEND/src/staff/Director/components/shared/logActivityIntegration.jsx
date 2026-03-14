
await logActivity(pool, {
  type:    'PAYMENT',
  actor:   requested_by,       // waiter name from req.body
  role:    'WAITER',
  message: `${requested_by} sent bill to cashier — ${table_name} · UGX ${amount?.toLocaleString()}`,
  meta:    { table_name, amount, method },
});


// ── sendToCashierRoutes.js — PATCH /:id/confirm ───────────────────────────────
// After UPDATE ... SET status='Confirmed':
await logActivity(pool, {
  type:    'PAYMENT',
  actor:   confirmed_by,       // from req.body
  role:    'CASHIER',
  message: `Payment confirmed — ${method} · UGX ${amount?.toLocaleString()} (${table_name})`,
  meta:    { table_name, amount, method, transaction_id },
});


// ── sendToCashierRoutes.js — PATCH /:id/reject ────────────────────────────────
await logActivity(pool, {
  type:    'PAYMENT',
  actor:   'Cashier',
  role:    'CASHIER',
  message: `Payment rejected — ${table_name} · UGX ${amount?.toLocaleString()} · Reason: ${reason}`,
  meta:    { table_name, amount, reason },
});


// ── sendToCashierRoutes.js — PATCH /:id/request-approval (credit forward) ────
await logActivity(pool, {
  type:    'CREDIT',
  actor:   requested_by,
  role:    'CASHIER',
  message: `Credit forwarded to manager — ${credit_name || 'client'} · UGX ${amount?.toLocaleString()} (${table_name})`,
  meta:    { table_name, amount, credit_name, credit_phone },
});


// ── managerRoutes.js — credit approve ─────────────────────────────────────────
await logActivity(pool, {
  type:    'CREDIT',
  actor:   approved_by,        // from req.body
  role:    'MANAGER',
  message: `Credit approved — ${credit_name} · UGX ${amount?.toLocaleString()} (${table_name})`,
  meta:    { table_name, amount, credit_name },
});


// ── managerRoutes.js — credit reject ──────────────────────────────────────────
await logActivity(pool, {
  type:    'CREDIT',
  actor:   rejected_by,
  role:    'MANAGER',
  message: `Credit rejected — ${credit_name} · UGX ${amount?.toLocaleString()} (${table_name})`,
  meta:    { table_name, amount, credit_name },
});


// ── waiterRoutes.js — POST /end-shift ─────────────────────────────────────────
await logActivity(pool, {
  type:    'SHIFT',
  actor:   staff_name,
  role:    role || 'WAITER',
  message: `${staff_name} ended shift — ${total_orders} orders · UGX ${gross_total?.toLocaleString()} gross`,
  meta:    { total_orders, total_cash, total_mtn, total_airtel, total_card, gross_total },
});


// ── staffRoutes.js — clock in / clock out ─────────────────────────────────────
// Clock in:
await logActivity(pool, {
  type:    'STAFF',
  actor:   staff_name,
  role:    role,
  message: `${staff_name} (${role}) clocked in`,
  meta:    { staff_id },
});
// Clock out:
await logActivity(pool, {
  type:    'STAFF',
  actor:   staff_name,
  role:    role,
  message: `${staff_name} (${role}) clocked out`,
  meta:    { staff_id },
});


// ── summaryRoutes.js — POST /petty-cash ───────────────────────────────────────
await logActivity(pool, {
  type:    'PETTY',
  actor:   logged_by,
  role:    'CASHIER',
  message: `Petty cash ${direction === 'OUT' ? 'expense' : 'cash in'} — ${category} · UGX ${amount?.toLocaleString()} (${description})`,
  meta:    { amount, direction, category, description },
});


// ── orderRoutes.js — new order placed ─────────────────────────────────────────
await logActivity(pool, {
  type:    'ORDER',
  actor:   staff_name,         // waiter name
  role:    'WAITER',
  message: `New order placed — ${table_name} · ${item_count} items · UGX ${total?.toLocaleString()}`,
  meta:    { table_name, total, item_count },
});


// ── accountantRoutes.js — void approved ───────────────────────────────────────
await logActivity(pool, {
  type:    'VOID',
  actor:   approved_by,
  role:    'ACCOUNTANT',
  message: `Void approved — Order #${order_id} · ${item_name} · UGX ${amount?.toLocaleString()}`,
  meta:    { order_id, item_name, amount },
});


// ── accountantRoutes.js — void rejected ───────────────────────────────────────
await logActivity(pool, {
  type:    'VOID',
  actor:   rejected_by,
  role:    'ACCOUNTANT',
  message: `Void rejected — Order #${order_id} · ${item_name}`,
  meta:    { order_id, item_name },
});