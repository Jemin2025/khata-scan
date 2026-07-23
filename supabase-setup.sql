-- ============================================================
-- Khata Scan — Supabase Database Setup
-- Supabase Dashboard → SQL Editor → New Query → paste this → Run
-- ============================================================

-- Users table (login accounts)
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Storage table (all app data: ledger, bills, orders, incoming, cheques)
CREATE TABLE IF NOT EXISTS storage (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT,               -- NULL for shared rows
  key        TEXT NOT NULL,
  shared     BOOLEAN NOT NULL DEFAULT FALSE,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: one row per (user, key) for personal data
CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_personal
  ON storage(user_id, key, shared)
  WHERE shared = FALSE;

-- Index: one row per key globally for shared data
CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_shared
  ON storage(key)
  WHERE shared = TRUE;

-- Row Level Security (RLS) — disable for service_role key access
-- (Our API uses service_role key, so RLS doesn't block us)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (already default, just being explicit)
CREATE POLICY "service_role_all_users" ON users
  FOR ALL USING (true);

CREATE POLICY "service_role_all_storage" ON storage
  FOR ALL USING (true);
