const db = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  let testResult = {};

  try {
    const users = await db.select('users');
    testResult.users_count = users.length;
    testResult.users = users.map(u => ({ username: u.username, id: u.id }));
  } catch (e) {
    testResult.error = e.message;
  }

  return res.json({
    backend_mode: 'Cloud JSON Store (Zero Setup, Zero SQL)',
    status: 'ONLINE',
    testResult
  });
};
