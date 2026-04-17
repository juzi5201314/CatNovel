CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'zh',
  synopsis TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS volumes (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_index INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  volume_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body_json TEXT NOT NULL,
  plaintext TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  character_count INTEGER NOT NULL DEFAULT 0,
  reading_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  last_autosaved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chapter_order (
  work_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  sort_index INTEGER NOT NULL,
  PRIMARY KEY (work_id, chapter_id),
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings_nodes (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  parent_id TEXT,
  node_type TEXT NOT NULL,
  title TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS book_metadata (
  work_id TEXT PRIMARY KEY,
  author_name TEXT NOT NULL DEFAULT '',
  premise TEXT NOT NULL DEFAULT '',
  target_readers TEXT NOT NULL DEFAULT '',
  serialized_status TEXT NOT NULL DEFAULT 'ongoing',
  tags_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS snapshot_items (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  body TEXT NOT NULL,
  tps REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_provider_profiles (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  family TEXT NOT NULL,
  label TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key_env TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS context_selections (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  chapter_id TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chapter_summaries (
  chapter_id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS generation_archive (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  chapter_id TEXT,
  task_class TEXT NOT NULL,
  provider_profile_id TEXT NOT NULL,
  prompt_excerpt TEXT NOT NULL,
  response_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS token_usage_records (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  provider_profile_id TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_preferences (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  source_format TEXT NOT NULL,
  status TEXT NOT NULL,
  log_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS export_jobs (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  target_format TEXT NOT NULL,
  status TEXT NOT NULL,
  output_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);
