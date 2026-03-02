PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects(updated_at);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  summary TEXT,
  "order" INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  CHECK ("order" >= 0)
);

CREATE INDEX IF NOT EXISTS chapters_project_order_idx
ON chapters(project_id, "order");

CREATE INDEX IF NOT EXISTS chapters_project_updated_at_idx
ON chapters(project_id, updated_at);

CREATE TABLE IF NOT EXISTS llm_providers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  category TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_ref TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  builtin_code TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS llm_providers_builtin_code_idx
ON llm_providers(builtin_code);

CREATE TABLE IF NOT EXISTS llm_model_presets (
  id TEXT PRIMARY KEY NOT NULL,
  provider_id TEXT NOT NULL REFERENCES llm_providers(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  api_format TEXT NOT NULL,
  model_id TEXT NOT NULL,
  temperature REAL,
  max_tokens INTEGER,
  thinking_budget_type TEXT,
  thinking_effort TEXT,
  thinking_tokens INTEGER,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS llm_model_presets_provider_purpose_idx
ON llm_model_presets(provider_id, purpose);

CREATE TABLE IF NOT EXISTS llm_default_selection (
  project_id TEXT PRIMARY KEY NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  default_chat_preset_id TEXT REFERENCES llm_model_presets(id) ON DELETE SET NULL,
  default_embedding_preset_id TEXT REFERENCES llm_model_presets(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS llm_default_selection_chat_idx
ON llm_default_selection(default_chat_preset_id);

CREATE INDEX IF NOT EXISTS llm_default_selection_embedding_idx
ON llm_default_selection(default_embedding_preset_id);

CREATE TABLE IF NOT EXISTS secret_store (
  id TEXT PRIMARY KEY NOT NULL,
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  tag TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS secret_store_key_version_idx
ON secret_store(key_version);

CREATE TABLE IF NOT EXISTS tool_policies (
  tool_name TEXT PRIMARY KEY NOT NULL,
  risk_level TEXT NOT NULL,
  requires_confirmation INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  CHECK (length(tool_name) >= 1)
);

CREATE TABLE IF NOT EXISTS tool_approval_requests (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  request_payload TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  requested_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  approved_at INTEGER,
  executed_at INTEGER,
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS tool_approval_requests_project_status_idx
ON tool_approval_requests(project_id, status);

CREATE INDEX IF NOT EXISTS tool_approval_requests_requested_at_idx
ON tool_approval_requests(requested_at);

CREATE INDEX IF NOT EXISTS tool_approval_requests_tool_name_idx
ON tool_approval_requests(tool_name);

CREATE TABLE IF NOT EXISTS tool_execution_logs (
  id TEXT PRIMARY KEY NOT NULL,
  approval_id TEXT,
  tool_name TEXT NOT NULL,
  input_payload TEXT NOT NULL,
  output_payload TEXT,
  exec_status TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS tool_execution_logs_approval_id_idx
ON tool_execution_logs(approval_id);

CREATE INDEX IF NOT EXISTS tool_execution_logs_created_at_idx
ON tool_execution_logs(created_at);
