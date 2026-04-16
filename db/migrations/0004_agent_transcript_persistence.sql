CREATE TABLE IF NOT EXISTS agent_transcript_entries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_call_id TEXT,
  tool_name TEXT,
  tool_args_json TEXT NOT NULL DEFAULT '{}',
  tool_result_json TEXT,
  is_error INTEGER NOT NULL DEFAULT 0,
  source_event_types_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_transcript_entries_session_sequence
  ON agent_transcript_entries (session_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_agent_transcript_entries_message
  ON agent_transcript_entries (message_id);

CREATE INDEX IF NOT EXISTS idx_agent_transcript_entries_tool_call
  ON agent_transcript_entries (tool_call_id);
