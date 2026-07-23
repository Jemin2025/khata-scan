// ═══════════════════════════════════════════════════════════════════════
// Persistent cloud storage — works with Upstash Redis (recommended)
// OR falls back to JSONBlob (no setup needed).
//
// Priority:
//   1. Upstash Redis  → set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//   2. JSONBlob       → set JSON_BLOB_URL  (default already hardcoded)
// ═══════════════════════════════════════════════════════════════════════

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const BLOB_URL      = process.env.JSON_BLOB_URL
  || 'https://jsonblob.com/api/jsonBlob/019f8f39-4b3d-7db7-9ef8-527dc603a4a8';

const USE_UPSTASH = !!(UPSTASH_URL && UPSTASH_TOKEN);

// ─── helpers ────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url, opts = {}, maxTries = 4) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.ok) return res;
      // 5xx → retry; 4xx → throw immediately
      if (res.status < 500) throw new Error(`HTTP ${res.status}`);
      if (i < maxTries - 1) await sleep(300 * (i + 1));
      else throw new Error(`HTTP ${res.status} after ${maxTries} tries`);
    } catch (e) {
      if (i < maxTries - 1) await sleep(300 * (i + 1));
      else throw e;
    }
  }
}

// ─── Upstash REST helpers ────────────────────────────────────────────────

async function upstashGet(key) {
  const res = await fetchWithRetry(
    `${UPSTASH_URL}/get/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }, cache: 'no-store' }
  );
  const json = await res.json();
  return json.result; // null if missing
}

async function upstashSet(key, value) {
  await fetchWithRetry(
    `${UPSTASH_URL}/set/${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    }
  );
}

async function upstashDel(key) {
  await fetchWithRetry(
    `${UPSTASH_URL}/del/${encodeURIComponent(key)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }
  );
}

// ─── JSONBlob helpers ────────────────────────────────────────────────────

async function blobGet() {
  const res = await fetchWithRetry(BLOB_URL, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  const data = await res.json();
  if (!data.users)   data.users   = [];
  if (!data.storage) data.storage = [];
  return data;
}

async function blobPut(data) {
  await fetchWithRetry(BLOB_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data)
  });
}

// Atomic read-modify-write for JSONBlob (needed because it's one big JSON)
async function blobAtomicUpdate(mutateFn) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const db = await blobGet();
      const result = mutateFn(db);
      await blobPut(db);
      return result;
    } catch (e) {
      if (attempt < 3) await sleep(400 * (attempt + 1) + Math.random() * 200);
      else throw e;
    }
  }
}

// ─── Unified DB API ──────────────────────────────────────────────────────

const db = {

  async selectOne(table, filters = {}) {
    if (USE_UPSTASH) {
      // ── Upstash path ──
      if (table === 'users') {
        if (filters.username) {
          const raw = await upstashGet(`users:u:${filters.username}`);
          if (!raw) return null;
          const user = typeof raw === 'string' ? JSON.parse(raw) : raw;
          // check remaining filters
          for (const [k, v] of Object.entries(filters)) {
            if (String(user[k]) !== String(v)) return null;
          }
          return user;
        }
        if (filters.id) {
          const raw = await upstashGet(`users:id:${filters.id}`);
          if (!raw) return null;
          return typeof raw === 'string' ? JSON.parse(raw) : raw;
        }
      }
      if (table === 'storage') {
        const { key, user_id, shared } = filters;
        const isShared = shared === true || shared === 'true';
        const storeKey = isShared ? `s:shared:${key}` : `s:${user_id}:${key}`;
        const raw = await upstashGet(storeKey);
        if (!raw) return null;
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      return null;

    } else {
      // ── JSONBlob path ──
      const fullDb = await blobGet();
      const list = fullDb[table] || [];
      return list.find(row => {
        for (const [k, v] of Object.entries(filters)) {
          if (String(row[k]) !== String(v)) return false;
        }
        return true;
      }) || null;
    }
  },

  async select(table, filters = {}) {
    const row = await db.selectOne(table, filters);
    return row ? [row] : [];
  },

  async insert(table, rowData) {
    const newRow = { id: Date.now(), ...rowData };

    if (USE_UPSTASH) {
      if (table === 'users') {
        const payload = JSON.stringify(newRow);
        await upstashSet(`users:u:${newRow.username}`, payload);
        await upstashSet(`users:id:${newRow.id}`, payload);
        return newRow;
      }
      throw new Error(`Upstash insert not supported for: ${table}`);
    } else {
      return blobAtomicUpdate(fullDb => {
        if (!fullDb[table]) fullDb[table] = [];
        fullDb[table].push(newRow);
        return newRow;
      });
    }
  },

  async upsert(table, rowData, matchKeys = []) {
    if (USE_UPSTASH) {
      if (table === 'storage') {
        const { key, user_id, shared, value } = rowData;
        const isShared = shared === true || shared === 'true' || shared === true;
        const storeKey = isShared ? `s:shared:${key}` : `s:${user_id}:${key}`;
        const updated = {
          ...rowData,
          shared: isShared,
          user_id: isShared ? null : user_id,
          updated_at: new Date().toISOString()
        };
        await upstashSet(storeKey, JSON.stringify(updated));
        return updated;
      }
      throw new Error(`Upstash upsert not supported for: ${table}`);
    } else {
      return blobAtomicUpdate(fullDb => {
        if (!fullDb[table]) fullDb[table] = [];
        const list = fullDb[table];
        const idx = list.findIndex(r =>
          matchKeys.every(k => String(r[k] ?? '') === String(rowData[k] ?? ''))
        );
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...rowData, updated_at: new Date().toISOString() };
          return list[idx];
        } else {
          const newRow = { id: Date.now(), ...rowData, updated_at: new Date().toISOString() };
          list.push(newRow);
          return newRow;
        }
      });
    }
  },

  async delete(table, filters = {}) {
    if (USE_UPSTASH) {
      if (table === 'storage') {
        const { key, user_id, shared } = filters;
        const isShared = shared === true || shared === 'true';
        const storeKey = isShared ? `s:shared:${key}` : `s:${user_id}:${key}`;
        await upstashDel(storeKey);
        return true;
      }
      return true;
    } else {
      return blobAtomicUpdate(fullDb => {
        if (!fullDb[table]) return true;
        fullDb[table] = fullDb[table].filter(row => {
          for (const [k, v] of Object.entries(filters)) {
            if (String(row[k]) === String(v)) return false;
          }
          return true;
        });
        return true;
      });
    }
  }
};

module.exports = db;
module.exports.isConfigured = () => USE_UPSTASH ? 'upstash' : 'jsonblob';
