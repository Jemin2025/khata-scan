const supabase = require('../../_lib/supabase');
const { requireAuth } = require('../../_lib/auth');

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

  // ── GET /api/storage/[key] ──────────────────────────────────────────────
  if (req.method === 'GET') {
    let query = supabase.from('storage').select('*').eq('key', key);

    if (shared) {
      query = query.eq('shared', true);
    } else {
      query = query.eq('shared', false).eq('user_id', userId);
    }

    const { data: row, error } = await query.single();

    if (error || !row) {
      return res.status(404).json({ error: 'Key not found' });
    }

    return res.json({ key: row.key, value: row.value, shared: row.shared });
  }

  // ── POST /api/storage/[key] ─────────────────────────────────────────────
  if (req.method === 'POST') {
    const { value, shared: bodyShared } = req.body || {};
    const isShared = !!bodyShared;

    if (typeof value !== 'string') {
      return res.status(400).json({ error: 'value must be a string (JSON.stringify it first)' });
    }
    if (Buffer.byteLength(value, 'utf8') > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Value too large (max 5MB)' });
    }

    let upsertData;
    let conflictCols;

    if (isShared) {
      upsertData = { key, shared: true, value, user_id: null, updated_at: new Date().toISOString() };
      conflictCols = 'key,shared';
    } else {
      upsertData = { key, shared: false, value, user_id: userId, updated_at: new Date().toISOString() };
      conflictCols = 'user_id,key,shared';
    }

    const { error } = await supabase
      .from('storage')
      .upsert(upsertData, { onConflict: conflictCols });

    if (error) {
      console.error('Storage upsert error:', error);
      return res.status(500).json({ error: 'Storage save failed' });
    }

    return res.json({ key, value, shared: isShared });
  }

  // ── DELETE /api/storage/[key] ───────────────────────────────────────────
  if (req.method === 'DELETE') {
    let query = supabase.from('storage').delete().eq('key', key);

    if (shared) {
      query = query.eq('shared', true);
    } else {
      query = query.eq('shared', false).eq('user_id', userId);
    }

    const { error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Delete failed' });
    }

    return res.json({ key, deleted: true, shared });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
