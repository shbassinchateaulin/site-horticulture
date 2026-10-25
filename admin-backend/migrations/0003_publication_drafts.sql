CREATE TABLE IF NOT EXISTS publication_drafts (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 kind TEXT NOT NULL,
 payload TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_publication_drafts_updated_at ON publication_drafts(updated_at DESC);
