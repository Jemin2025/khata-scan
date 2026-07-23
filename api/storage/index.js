const supabase = require('../_lib/supabase');
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

  let query = supabase.from('storage').select('key');

  if (shared) {
    query = query.eq('shared', true);
  } else {
    query = query.eq('shared', false).eq('user_id', userId);
  }

  if (prefix) {
    query = query.like('key', `${prefix}%`);
  }

  const { data: rows, error } = await query;

  if (error) {
    return res.status(500).json({ error: 'Storage list failed' });
  }

  return res.json({ keys: (rows || []).map(r => r.key), prefix, shared });
};
