-- 你也分享: public posts and a submissions log for rate limiting / de-duplication.
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  original TEXT NOT NULL,
  rewrite TEXT NOT NULL,
  mottos TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  delete_token TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS posts_visible ON posts(hidden, id DESC);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  outcome TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS submissions_ip ON submissions(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS submissions_text ON submissions(text_hash, created_at);
