// Cloud JSON Store — atomic read-modify-write with retry (works across serverless instances)
const BLOB_URL = process.env.JSON_BLOB_URL || 'https://jsonblob.com/api/jsonBlob/019f8f39-4b3d-7db7-9ef8-527dc603a4a8';
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 200;

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function getFullDb() {
  const res = await fetch(BLOB_URL, {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store'
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

// Atomic read-modify-write with retry — works across multiple serverless instances
async function atomicUpdate(mutateFn) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const fullDb = await getFullDb();
      const result = mutateFn(fullDb);
      await saveFullDb(fullDb);
      return result;
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) {
        // Jitter to avoid thundering herd
        await sleep(RETRY_DELAY_MS * (attempt + 1) + Math.random() * 100);
      } else {
        throw err;
      }
    }
  }
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
    return atomicUpdate(fullDb => {
      if (!fullDb[table]) fullDb[table] = [];
      const newRow = { id: Date.now() + Math.random(), ...rowData };
      fullDb[table].push(newRow);
      return newRow;
    });
  },

  // UPSERT row
  async upsert(table, rowData, matchKeys = ['user_id', 'key', 'shared']) {
    return atomicUpdate(fullDb => {
      if (!fullDb[table]) fullDb[table] = [];
      const list = fullDb[table];
      const index = list.findIndex(r => {
        return matchKeys.every(k => String(r[k] ?? '') === String(rowData[k] ?? ''));
      });

      if (index >= 0) {
        list[index] = { ...list[index], ...rowData, updated_at: new Date().toISOString() };
        return list[index];
      } else {
        const newRow = { id: Date.now() + Math.random(), ...rowData, updated_at: new Date().toISOString() };
        list.push(newRow);
        return newRow;
      }
    });
  },

  // DELETE rows matching filters
  async delete(table, filters = {}) {
    return atomicUpdate(fullDb => {
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
};

module.exports = db;
