PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS project_settings (
  project_id TEXT PRIMARY KEY NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  system_prompt TEXT NOT NULL DEFAULT '你是一名专业写作编辑，擅长文案创作、故事叙事、结构优化与语气调整。
回答应兼顾创意与逻辑，并保证语言流畅。
鼓励表达多样性与原创性，避免陈词滥调。',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS project_settings_updated_at_idx
ON project_settings(updated_at);

INSERT INTO project_settings (project_id, system_prompt)
SELECT
  projects.id,
  '你是一名专业写作编辑，擅长文案创作、故事叙事、结构优化与语气调整。
回答应兼顾创意与逻辑，并保证语言流畅。
鼓励表达多样性与原创性，避免陈词滥调。'
FROM projects
WHERE NOT EXISTS (
  SELECT 1
  FROM project_settings
  WHERE project_settings.project_id = projects.id
);

