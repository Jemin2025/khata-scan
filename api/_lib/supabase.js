// Direct Supabase REST API helper — no SDK needed
let SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
// If user accidentally included /rest/v1 in SUPABASE_URL, trim it
if (SUPABASE_URL.endsWith('/rest/v1')) {
  SUPABASE_URL = SUPABASE_URL.substring(0, SUPABASE_URL.length - '/rest/v1'.length);
}

const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();

function getHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

const db = {
  // SELECT — returns array of rows
  async select(table, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    for (const [key, val] of Object.entries(filters)) {
      url += `&${key}=eq.${encodeURIComponent(val)}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Supabase select failed: ${await res.text()}`);
    return res.json();
  },

  // SELECT single row
  async selectOne(table, filters = {}) {
    const rows = await db.select(table, filters);
    return rows[0] || null;
  },

  // INSERT — returns inserted row
  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Supabase insert failed: ${await res.text()}`);
    const rows = await res.json();
    return rows[0] || rows;
  },

  // UPSERT — insert or update
  async upsert(table, data, onConflict) {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    if (onConflict) url += `?on_conflict=${encodeURIComponent(onConflict)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...getHeaders(), 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Supabase upsert failed: ${await res.text()}`);
    return res.json();
  },

  // DELETE
  async delete(table, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    for (const [key, val] of Object.entries(filters)) {
      url += `${key}=eq.${encodeURIComponent(val)}&`;
    }
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(`Supabase delete failed: ${await res.text()}`);
    return true;
  }
};

module.exports = db;
