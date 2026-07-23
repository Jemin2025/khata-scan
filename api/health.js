const db = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const configured = db.isConfigured();
  return res.json({
    ok: true,
    time: new Date().toISOString(),
    db: configured ? 'upstash' : 'memory (set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)'
  });
};
