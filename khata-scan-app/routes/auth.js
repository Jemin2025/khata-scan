const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, signToken } = require('../middleware/auth');

const router = express.Router();

const SIGNUP_KEY = process.env.SIGNUP_KEY || '';

router.post('/register', (req, res) => {
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
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
  if (existing) {
    return res.status(409).json({ error: 'Yeh username pehle se hai — dusra try karo.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(cleanUsername, passwordHash);

  const user = { id: info.lastInsertRowid, username: cleanUsername };
  const token = signToken(user);
  res.status(201).json({ token, username: user.username });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username aur password dono do.' });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Username ya password galat hai.' });
  }

  const token = signToken(user);
  res.json({ token, username: user.username });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.username });
});

module.exports = router;
