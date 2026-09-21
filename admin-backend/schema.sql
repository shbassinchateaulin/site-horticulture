CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 external_id TEXT NOT NULL DEFAULT '',
 username TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL DEFAULT '',
 email TEXT NOT NULL DEFAULT '',
 password_hash TEXT NOT NULL,
 password_salt TEXT NOT NULL,
 password_iterations INTEGER NOT NULL DEFAULT 0,
 role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('super_admin','admin','publisher','member')),
 permissions TEXT NOT NULL DEFAULT '[]',
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 client_key TEXT NOT NULL,
 username TEXT NOT NULL DEFAULT '',
 success INTEGER NOT NULL DEFAULT 0,
 attempted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_client_date ON login_attempts(client_key,attempted_at);
