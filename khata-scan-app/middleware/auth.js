const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Login required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.uid;
    req.username = payload.username;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired ya invalid — dobara login karo.' });
  }
}

function signToken(user) {
  return jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
}

module.exports = { requireAuth, signToken, JWT_SECRET };
