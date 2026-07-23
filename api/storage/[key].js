const { requireAuth } = require('../../_lib/auth');
const db = require('../../_lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  const { userId } = user;
  const key = req.query.key;
  const shared = String(req.query.shared).toLowerCase() === 'true';

  if (!key || key.length > 200 || /[\s/\\'"]/.test(key)) {
    return res.status(400).json({ error: 'Invalid key' });
  }

  try {
    // ── GET ───────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const filter = { key, shared };
      if (!shared) filter.user_id = userId;

      const row = await db.selectOne('storage', filter);
      if (!row) return res.status(404).json({ error: 'Key not found' });
      return res.json({ key: row.key, value: row.value, shared: row.shared });
    }

    // ── POST ──────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { value, shared: bodyShared } = req.body || {};
      const isShared = !!bodyShared;

      if (typeof value !== 'string') {
        return res.status(400).json({ error: 'value must be a string' });
      }
      if (Buffer.byteLength(value, 'utf8') > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Value too large (max 5MB)' });
      }

      const rowData = {
        key,
        shared: isShared,
        value,
        user_id: isShared ? null : userId
      };

      const matchKeys = isShared ? ['key', 'shared'] : ['user_id', 'key', 'shared'];
      const saved = await db.upsert('storage', rowData, matchKeys);

      return res.json({ key: saved.key, value: saved.value, shared: saved.shared });
    }

    // ── DELETE ────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const filter = { key, shared };
      if (!shared) filter.user_id = userId;

      await db.delete('storage', filter);
      return res.json({ key, deleted: true, shared });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Storage error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
