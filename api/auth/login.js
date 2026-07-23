const bcrypt = require('bcryptjs');
const db = require('../_lib/supabase');
const { signToken } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username aur password dono do.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const user = await db.selectOne('users', { username: cleanUsername });

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Username ya password galat hai.' });
    }

    const token = signToken(user);
    return res.json({ token, username: user.username });

  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
