const db = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = process.env.SUPABASE_URL || 'NOT SET';
  const key = process.env.SUPABASE_SERVICE_KEY || 'NOT SET';

  let testResult = {};

  try {
    // 1. Direct fetch root rest/v1/
    const rRoot = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    testResult.root_status = rRoot.status;
    testResult.root_text = (await rRoot.text()).substring(0, 200);
  } catch (e) {
    testResult.root_error = e.message;
  }

  try {
    // 2. Direct fetch users table
    const rUsers = await fetch(`${url.replace(/\/$/, '')}/rest/v1/users?select=*`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    testResult.users_status = rUsers.status;
    testResult.users_response = (await rUsers.text()).substring(0, 300);
  } catch (e) {
    testResult.users_error = e.message;
  }

  return res.json({
    env_SUPABASE_URL: url,
    key_prefix: key.substring(0, 10),
    testResult
  });
};
