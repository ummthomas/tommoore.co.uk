-- The note wall's tables. Applied by setup.sh (wrangler d1 migrations apply).

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message INTEGER NOT NULL,
  colour INTEGER NOT NULL,
  place TEXT,
  country TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS notes_created ON notes (created_at);

-- One row per visitor per day, by a hash that changes daily, to allow one note each
CREATE TABLE IF NOT EXISTS daily (
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, visitor)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
