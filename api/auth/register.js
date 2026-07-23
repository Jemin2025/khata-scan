const bcrypt = require('bcryptjs');
const db = require('../_lib/supabase');
const { signToken } = require('../_lib/auth');

const SIGNUP_KEY = process.env.SIGNUP_KEY || '';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Signup-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { username, password } = req.body || {};

    if (SIGNUP_KEY) {
      const provided = req.headers['x-signup-key'] || '';
      if (provided !== SIGNUP_KEY) {
        return res.status(403).json({ error: 'Signup band hai — sahi signup key do.' });
      }
    }

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username kam se kam 3 characters ka hona chahiye.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password kam se kam 6 characters ka hona chahiye.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    const existing = await db.selectOne('users', { username: cleanUsername });
    if (existing) {
      return res.status(409).json({ error: 'Yeh username pehle se hai — dusra try karo.' });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const newUser = await db.insert('users', {
      username: cleanUsername,
      password_hash,
      created_at: new Date().toISOString()
    });

    const token = signToken(newUser);
    return res.status(201).json({ token, username: newUser.username });

  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
