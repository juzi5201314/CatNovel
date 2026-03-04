CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  chapter_id TEXT,
  title TEXT NOT NULL,
  messages_json TEXT NOT NULL DEFAULT '[]',
  message_count INTEGER NOT NULL DEFAULT 0,
  chat_terminated INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS chat_sessions_project_chapter_updated_idx
ON chat_sessions(project_id, chapter_id, updated_at);

CREATE INDEX IF NOT EXISTS chat_sessions_project_updated_idx
ON chat_sessions(project_id, updated_at);
