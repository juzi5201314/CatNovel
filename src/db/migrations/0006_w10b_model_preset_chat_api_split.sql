PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE llm_model_presets__new (
  id TEXT PRIMARY KEY NOT NULL,
  provider_id TEXT NOT NULL REFERENCES llm_providers(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  chat_api_format TEXT,
  model_id TEXT NOT NULL,
  custom_user_agent TEXT,
  temperature REAL,
  max_tokens INTEGER,
  thinking_budget_type TEXT,
  thinking_effort TEXT,
  thinking_tokens INTEGER,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  CONSTRAINT llm_model_presets_purpose_chat_format_check CHECK (
    (purpose = 'chat' AND chat_api_format IS NOT NULL) OR
    (purpose = 'embedding' AND chat_api_format IS NULL)
  )
);

INSERT INTO llm_model_presets__new (
  id,
  provider_id,
  purpose,
  chat_api_format,
  model_id,
  custom_user_agent,
  temperature,
  max_tokens,
  thinking_budget_type,
  thinking_effort,
  thinking_tokens,
  is_builtin,
  created_at,
  updated_at
)
SELECT
  id,
  provider_id,
  purpose,
  CASE
    WHEN purpose = 'chat' THEN
      CASE
        WHEN api_format = 'responses' THEN 'responses'
        ELSE 'chat_completions'
      END
    ELSE NULL
  END AS chat_api_format,
  model_id,
  custom_user_agent,
  temperature,
  max_tokens,
  thinking_budget_type,
  thinking_effort,
  thinking_tokens,
  is_builtin,
  created_at,
  updated_at
FROM llm_model_presets;

DROP TABLE llm_model_presets;
ALTER TABLE llm_model_presets__new RENAME TO llm_model_presets;

CREATE INDEX IF NOT EXISTS llm_model_presets_provider_purpose_idx
ON llm_model_presets(provider_id, purpose);

COMMIT;

PRAGMA foreign_keys = ON;
