const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function isShared(req) {
  return String(req.query.shared).toLowerCase() === 'true';
}

// GET /api/storage?prefix=&shared=
router.get('/', (req, res) => {
  const prefix = req.query.prefix || '';
  const shared = isShared(req);

  let rows;
  if (shared) {
    rows = db
      .prepare('SELECT key FROM storage WHERE shared = 1 AND key LIKE ?')
      .all(prefix + '%');
  } else {
    rows = db
      .prepare('SELECT key FROM storage WHERE shared = 0 AND user_id = ? AND key LIKE ?')
      .all(req.userId, prefix + '%');
  }

  res.json({ keys: rows.map((r) => r.key), prefix, shared });
});

// GET /api/storage/:key?shared=
router.get('/:key', (req, res) => {
  const { key } = req.params;
  const shared = isShared(req);

  const row = shared
    ? db.prepare('SELECT * FROM storage WHERE shared = 1 AND key = ?').get(key)
    : db.prepare('SELECT * FROM storage WHERE shared = 0 AND user_id = ? AND key = ?').get(req.userId, key);

  if (!row) {
    return res.status(404).json({ error: 'Key not found' });
  }
  res.json({ key: row.key, value: row.value, shared: !!row.shared });
});

// POST /api/storage/:key  body: { value, shared }
router.post('/:key', (req, res) => {
  const { key } = req.params;
  const { value } = req.body || {};
  const shared = !!(req.body && req.body.shared);

  if (typeof value !== 'string') {
    return res.status(400).json({ error: 'value must be a string (JSON.stringify it first)' });
  }
  if (key.length > 200 || /[\s/\\'"]/.test(key)) {
    return res.status(400).json({ error: 'Invalid key' });
  }
  if (Buffer.byteLength(value, 'utf8') > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Value too large (max 5MB)' });
  }

  if (shared) {
    db.prepare(
      `INSERT INTO storage (user_id, key, shared, value, updated_at)
       VALUES (NULL, ?, 1, ?, datetime('now'))
       ON CONFLICT(key) WHERE shared = 1
       DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).run(key, value);
  } else {
    db.prepare(
      `INSERT INTO storage (user_id, key, shared, value, updated_at)
       VALUES (?, ?, 0, ?, datetime('now'))
       ON CONFLICT(user_id, key) WHERE shared = 0
       DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).run(req.userId, key, value);
  }

  res.json({ key, value, shared });
});

// DELETE /api/storage/:key?shared=
router.delete('/:key', (req, res) => {
  const { key } = req.params;
  const shared = isShared(req);

  const info = shared
    ? db.prepare('DELETE FROM storage WHERE shared = 1 AND key = ?').run(key)
    : db.prepare('DELETE FROM storage WHERE shared = 0 AND user_id = ? AND key = ?').run(req.userId, key);

  res.json({ key, deleted: info.changes > 0, shared });
});

module.exports = router;
