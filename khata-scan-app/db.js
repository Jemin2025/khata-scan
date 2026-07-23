const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'data', 'khata.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS storage (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,               -- NULL for shared rows
    key        TEXT NOT NULL,
    shared     INTEGER NOT NULL DEFAULT 0,
    value      TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- one row per (user, key) for personal data
  CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_personal
    ON storage(user_id, key) WHERE shared = 0;

  -- one row per key globally for shared data
  CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_shared
    ON storage(key) WHERE shared = 1;
`);

module.exports = db;
