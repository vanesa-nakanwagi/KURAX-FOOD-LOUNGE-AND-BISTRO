const sseClients = new Set();

export function registerSSEClient(res) { sseClients.add(res); }
export function removeSSEClient(res) { sseClients.delete(res); }

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  sseClients.forEach(client => {
    try { client.write(data); } catch { sseClients.delete(client); }
  });
}

export default async function logActivity(pool, activity, legacyMessage, legacyMeta = {}) {
  const event = typeof activity === 'string'
    ? {
        type: activity,
        actor: legacyMeta.actor,
        role: legacyMeta.role,
        message: legacyMessage,
        meta: legacyMeta,
      }
    : activity || {};
  const { type, actor, role, message, meta = {} } = event;
  const details = meta && typeof meta === 'object' ? meta : {};
  let row = null;

  try {
    const result = await pool.query(
      `INSERT INTO activity_logs (type, actor, role, action_text, meta)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [type, actor, role, message, JSON.stringify(details)]
    );

    // Format for the frontend (mapping action_text back to message)
    row = { ...result.rows[0], message: result.rows[0].action_text };
  } catch (err) {
    console.error('[logActivity] Error:', err.message);
  }

  if (typeof type === 'string' && type.startsWith('CREDIT_')) {
    try {
      await pool.query(
        `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
         VALUES ('credit', $1, $2, $3, $4)`,
        [details.credit_id ?? null, type, actor || null, JSON.stringify({ message, ...details })]
      );
    } catch (err) {
      console.error('[logActivity] Credit audit error:', err.message);
    }
  }

  if (row) broadcast(row);
  return row;
}