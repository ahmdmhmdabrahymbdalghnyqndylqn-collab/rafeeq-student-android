CREATE TABLE IF NOT EXISTS book_chunks (
  id TEXT PRIMARY KEY,
  book_id INTEGER NOT NULL,
  book_title TEXT NOT NULL,
  subject TEXT NOT NULL,
  page INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_book_chunks_subject ON book_chunks(subject);
CREATE INDEX IF NOT EXISTS idx_book_chunks_book_id ON book_chunks(book_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  client_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
