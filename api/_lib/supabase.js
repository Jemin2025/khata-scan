// ═══════════════════════════════════════════════════════
// Upstash Redis REST API — reliable, serverless-friendly
// Free tier: 10,000 req/day — https://upstash.com
//
// Required env vars (add in Vercel Dashboard → Settings → Environment Variables):
//   UPSTASH_REDIS_REST_URL   = https://YOUR-DB.upstash.io
//   UPSTASH_REDIS_REST_TOKEN = YOUR_TOKEN
// ═══════════════════════════════════════════════════════

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Fallback: if Upstash is not configured, use in-memory store (dev only)
const memStore = {};

function isConfigured() {
  return !!(UPSTASH_URL && UPSTASH_TOKEN);
}

// ─── Upstash REST helpers ──────────────────────────────
async function kvGet(key) {
  if (!isConfigured()) {
    return memStore[key] !== undefined ? memStore[key] : null;
  }
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Upstash GET failed: ${res.status}`);
  const json = await res.json();
  return json.result; // null if key doesn't exist
}

async function kvSet(key, value) {
  if (!isConfigured()) {
    memStore[key] = value;
    return 'OK';
  }
  const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(value)
  });
  if (!res.ok) throw new Error(`Upstash SET failed: ${res.status}`);
  return 'OK';
}

async function kvDel(key) {
  if (!isConfigured()) {
    delete memStore[key];
    return 1;
  }
  const res = await fetch(`${UPSTASH_URL}/del/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  if (!res.ok) throw new Error(`Upstash DEL failed: ${res.status}`);
  return 1;
}

// ─── DB abstraction (same interface as before) ─────────
// Instead of one big JSON blob, each row is stored as its own key:
//   users:username:<name>        → user object
//   users:id:<id>                → user object  
//   storage:<userId>:<key>       → value string
//   storage:shared:<key>         → shared value string

const db = {
  // ── users ─────────────────────────────────────────────
  async selectOne(table, filters = {}) {
    if (table === 'users') {
      // Lookup by username (most common)
      if (filters.username) {
        const data = await kvGet(`users:username:${filters.username}`);
        if (!data) return null;
        const user = typeof data === 'string' ? JSON.parse(data) : data;
        // Apply remaining filters
        for (const [k, v] of Object.entries(filters)) {
          if (String(user[k]) !== String(v)) return null;
        }
        return user;
      }
      // Lookup by id
      if (filters.id) {
        const data = await kvGet(`users:id:${filters.id}`);
        if (!data) return null;
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
    }
    // storage table
    if (table === 'storage') {
      const { key, user_id, shared } = filters;
      const storeKey = shared === true || shared === 'true'
        ? `storage:shared:${key}`
        : `storage:${user_id}:${key}`;
      const data = await kvGet(storeKey);
      if (!data) return null;
      return typeof data === 'string' ? JSON.parse(data) : data;
    }
    return null;
  },

  async select(table, filters = {}) {
    const row = await db.selectOne(table, filters);
    return row ? [row] : [];
  },

  async insert(table, rowData) {
    if (table === 'users') {
      const newUser = { id: Date.now(), ...rowData };
      const payload = JSON.stringify(newUser);
      await kvSet(`users:username:${newUser.username}`, payload);
      await kvSet(`users:id:${newUser.id}`, payload);
      return newUser;
    }
    throw new Error(`insert not supported for table: ${table}`);
  },

  async upsert(table, rowData, matchKeys = []) {
    if (table === 'storage') {
      const { key, user_id, shared, value, ...rest } = rowData;
      const isShared = shared === true || shared === 'true';
      const storeKey = isShared
        ? `storage:shared:${key}`
        : `storage:${user_id}:${key}`;

      const existing = await kvGet(storeKey);
      const prev = existing
        ? (typeof existing === 'string' ? JSON.parse(existing) : existing)
        : {};

      const updated = {
        ...prev,
        key,
        shared: isShared,
        user_id: isShared ? null : user_id,
        value,
        updated_at: new Date().toISOString()
      };
      await kvSet(storeKey, JSON.stringify(updated));
      return updated;
    }
    throw new Error(`upsert not supported for table: ${table}`);
  },

  async delete(table, filters = {}) {
    if (table === 'storage') {
      const { key, user_id, shared } = filters;
      const isShared = shared === true || shared === 'true';
      const storeKey = isShared
        ? `storage:shared:${key}`
        : `storage:${user_id}:${key}`;
      await kvDel(storeKey);
      return true;
    }
    return true;
  }
};

module.exports = db;
module.exports.isConfigured = isConfigured;
