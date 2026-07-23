-- 1. Disable Row Level Security (RLS)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage DISABLE ROW LEVEL SECURITY;

-- 2. Clear old user if exists and insert clean user for anjani (password: anjani123)
DELETE FROM users WHERE username = 'anjani';

INSERT INTO users (username, password_hash)
VALUES ('anjani', '$2a$10$D8dIQ.e.I0Rt4at47Pka1OBZckmKho4XAoxeaZ1wbo4SWbR427xIS');
