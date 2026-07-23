function cleanUrl(raw) {
  if (!raw) return '';
  try {
    const u = new URL(raw.trim());
    return u.origin;
  } catch (e) {
    return raw.trim().replace(/\/+$/, '');
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const rawUrl = process.env.SUPABASE_URL || 'NOT SET';
  const cleanedUrl = cleanUrl(rawUrl);
  const key = (process.env.SUPABASE_SERVICE_KEY || '').trim();

  let testResult = {};

  try {
    const rUsers = await fetch(`${cleanedUrl}/rest/v1/users?select=*`, {
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
    raw_env_SUPABASE_URL: rawUrl,
    cleaned_SUPABASE_URL: cleanedUrl,
    key_prefix: key.substring(0, 10),
    testResult
  });
};
