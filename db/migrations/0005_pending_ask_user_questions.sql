CREATE TABLE IF NOT EXISTS pending_ask_user_questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  tool_call_id TEXT NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT,
  multiselect INTEGER NOT NULL DEFAULT 0,
  context TEXT,
  question_type TEXT NOT NULL DEFAULT 'text' CHECK (question_type IN ('text', 'choice')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_ask_user_session_tool
  ON pending_ask_user_questions (session_id, tool_call_id);

CREATE INDEX IF NOT EXISTS idx_pending_ask_user_session
  ON pending_ask_user_questions (session_id);
