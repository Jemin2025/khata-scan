module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = process.env.SUPABASE_URL || 'NOT SET';
  const keySet = process.env.SUPABASE_SERVICE_KEY ? 'SET (length: ' + process.env.SUPABASE_SERVICE_KEY.length + ')' : 'NOT SET';
  const jwtSet = process.env.JWT_SECRET ? 'SET' : 'NOT SET';

  // Test Supabase connection
  let supabaseTest = 'not tested';
  if (url !== 'NOT SET') {
    try {
      const r = await fetch(`${url}/rest/v1/`, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY || '',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || ''}`
        }
      });
      supabaseTest = `HTTP ${r.status}`;
    } catch (e) {
      supabaseTest = 'FAILED: ' + e.message;
    }
  }

  return res.json({
    SUPABASE_URL: url,
    SUPABASE_SERVICE_KEY: keySet,
    JWT_SECRET: jwtSet,
    supabase_connection_test: supabaseTest
  });
};
