CREATE TABLE IF NOT EXISTS chat_session_runs (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  chapter_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  stop_requested INTEGER NOT NULL DEFAULT 0,
  input_messages_json TEXT NOT NULL DEFAULT '[]',
  response_message_json TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  started_at INTEGER,
  finished_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  CHECK (status IN ('queued', 'running', 'completed', 'failed', 'stopped'))
);

CREATE INDEX IF NOT EXISTS chat_session_runs_session_created_idx
ON chat_session_runs(session_id, created_at);

CREATE INDEX IF NOT EXISTS chat_session_runs_project_status_updated_idx
ON chat_session_runs(project_id, status, updated_at);
