// Instant Cloud JSON Store — 0-config, 0-SQL, 100% persistent backend
const BLOB_URL = process.env.JSON_BLOB_URL || 'https://jsonblob.com/api/jsonBlob/019f8f39-4b3d-7db7-9ef8-527dc603a4a8';

// Lock helper to prevent race conditions during concurrent updates
let lockPromise = Promise.resolve();

function withLock(fn) {
  const next = lockPromise.then(fn, fn);
  lockPromise = next;
  return next;
}

async function getFullDb() {
  const res = await fetch(BLOB_URL, {
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`Cloud DB fetch failed: ${res.status}`);
  const data = await res.json();
  if (!data.users) data.users = [];
  if (!data.storage) data.storage = [];
  return data;
}

async function saveFullDb(data) {
  const res = await fetch(BLOB_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Cloud DB save failed: ${res.status}`);
  return true;
}

const db = {
  // SELECT rows from table matching filters
  async select(table, filters = {}) {
    const fullDb = await getFullDb();
    const list = fullDb[table] || [];
    return list.filter(row => {
      for (const [k, v] of Object.entries(filters)) {
        if (String(row[k]) !== String(v)) return false;
      }
      return true;
    });
  },

  // SELECT single row
  async selectOne(table, filters = {}) {
    const rows = await db.select(table, filters);
    return rows[0] || null;
  },

  // INSERT row into table
  async insert(table, rowData) {
    return withLock(async () => {
      const fullDb = await getFullDb();
      if (!fullDb[table]) fullDb[table] = [];
      
      const newRow = { id: Date.now(), ...rowData };
      fullDb[table].push(newRow);
      await saveFullDb(fullDb);
      return newRow;
    });
  },

  // UPSERT row
  async upsert(table, rowData, matchKeys = ['user_id', 'key', 'shared']) {
    return withLock(async () => {
      const fullDb = await getFullDb();
      if (!fullDb[table]) fullDb[table] = [];

      const list = fullDb[table];
      const index = list.findIndex(r => {
        return matchKeys.every(k => String(r[k] ?? '') === String(rowData[k] ?? ''));
      });

      if (index >= 0) {
        list[index] = { ...list[index], ...rowData, updated_at: new Date().toISOString() };
        await saveFullDb(fullDb);
        return list[index];
      } else {
        const newRow = { id: Date.now(), ...rowData, updated_at: new Date().toISOString() };
        list.push(newRow);
        await saveFullDb(fullDb);
        return newRow;
      }
    });
  },

  // DELETE rows matching filters
  async delete(table, filters = {}) {
    return withLock(async () => {
      const fullDb = await getFullDb();
      if (!fullDb[table]) return true;

      fullDb[table] = fullDb[table].filter(row => {
        for (const [k, v] of Object.entries(filters)) {
          if (String(row[k]) === String(v)) return false;
        }
        return true;
      });
      await saveFullDb(fullDb);
      return true;
    });
  }
};

module.exports = db;
