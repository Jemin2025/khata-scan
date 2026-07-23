const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';

function requireAuth(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Login required.' });
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return { userId: payload.uid, username: payload.username };
  } catch (e) {
    res.status(401).json({ error: 'Session expired ya invalid — dobara login karo.' });
    return null;
  }
}

function signToken(user) {
  return jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
}

module.exports = { requireAuth, signToken };
