const sseClients = new Set();

export function registerSSEClient(res) { sseClients.add(res); }
export function removeSSEClient(res) { sseClients.delete(res); }

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  sseClients.forEach(client => {
    try { client.write(data); } catch { sseClients.delete(client); }
  });
}

export default async function logActivity(pool, { type, actor, role, message, meta = {} }) {
  try {
    const result = await pool.query(
      `INSERT INTO activity_logs (type, actor, role, action_text, meta)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [type, actor, role, message, JSON.stringify(meta)]
    );
    
    // Format for the frontend (mapping action_text back to message)
    const row = { ...result.rows[0], message: result.rows[0].action_text };
    broadcast(row);
    return row;
  } catch (err) {
    console.error('[logActivity] Error:', err.message);
    return null;
  }
}