const db = require('../_lib/supabase');
const { requireAuth } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  const { userId } = user;
  const prefix = req.query.prefix || '';
  const shared = String(req.query.shared).toLowerCase() === 'true';

  try {
    const filter = { shared };
    if (!shared) filter.user_id = userId;

    let rows = await db.select('storage', filter);
    if (prefix) {
      rows = rows.filter(r => String(r.key || '').startsWith(prefix));
    }

    return res.json({ keys: (rows || []).map(r => r.key), prefix, shared });
  } catch (err) {
    console.error('Storage list error:', err.message);
    return res.status(500).json({ error: 'Storage list failed: ' + err.message });
  }
};
