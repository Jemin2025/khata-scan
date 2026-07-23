const { requireAuth } = require('../../_lib/auth');

function cleanUrl(raw) {
  if (!raw) return '';
  try {
    const u = new URL(raw.trim());
    return u.origin;
  } catch (e) {
    return raw.trim().replace(/\/+$/, '');
  }
}

const SUPABASE_URL = cleanUrl(process.env.SUPABASE_URL);
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();

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
      let url = `${SUPABASE_URL}/rest/v1/storage?key=eq.${encodeURIComponent(key)}&shared=eq.${shared}`;
      if (!shared) url += `&user_id=eq.${userId}`;
      url += '&limit=1';

      const res2 = await fetch(url, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      const rows = await res2.json();
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Key not found' });
      const row = rows[0];
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

      const data = {
        key,
        shared: isShared,
        value,
        user_id: isShared ? null : userId,
        updated_at: new Date().toISOString()
      };

      const onConflict = isShared ? 'key,shared' : 'user_id,key,shared';
      const upsertUrl = `${SUPABASE_URL}/rest/v1/storage?on_conflict=${encodeURIComponent(onConflict)}`;

      const r = await fetch(upsertUrl, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation,resolution=merge-duplicates'
        },
        body: JSON.stringify(data)
      });

      if (!r.ok) {
        const errText = await r.text();
        console.error('Storage upsert error:', errText);
        return res.status(500).json({ error: 'Storage save failed: ' + errText });
      }

      return res.json({ key, value, shared: isShared });
    }

    // ── DELETE ────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      let url = `${SUPABASE_URL}/rest/v1/storage?key=eq.${encodeURIComponent(key)}&shared=eq.${shared}`;
      if (!shared) url += `&user_id=eq.${userId}`;

      await fetch(url, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });

      return res.json({ key, deleted: true, shared });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Storage error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
