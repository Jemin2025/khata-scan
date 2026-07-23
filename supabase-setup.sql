-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Storage table
CREATE TABLE IF NOT EXISTS storage (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT,
  key        TEXT NOT NULL,
  shared     BOOLEAN NOT NULL DEFAULT FALSE,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_personal
  ON storage(user_id, key, shared)
  WHERE shared = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_shared
  ON storage(key)
  WHERE shared = TRUE;

-- 4. Disable RLS so API has full access
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage DISABLE ROW LEVEL SECURITY;

-- 5. Insert ready-made Account for Anjani (Password: anjani123)
INSERT INTO users (username, password_hash)
VALUES ('anjani', '$2a$10$D8ljgsW5loeHfg7xoY8GCOd5sYklvOdyZbquI.EXU9a8kWJArE9nG')
ON CONFLICT (username) DO NOTHING;
