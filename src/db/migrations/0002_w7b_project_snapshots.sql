PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS project_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  source_snapshot_id TEXT,
  trigger_type TEXT NOT NULL,
  trigger_reason TEXT NOT NULL,
  chapter_count INTEGER NOT NULL,
  timeline_event_count INTEGER NOT NULL,
  timeline_summary TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  CHECK (trigger_type IN ('auto', 'manual', 'restore')),
  CHECK (length(trigger_reason) >= 1),
  CHECK (chapter_count >= 0),
  CHECK (timeline_event_count >= 0)
);

CREATE INDEX IF NOT EXISTS project_snapshots_project_created_at_idx
ON project_snapshots(project_id, created_at);

CREATE INDEX IF NOT EXISTS project_snapshots_project_trigger_type_idx
ON project_snapshots(project_id, trigger_type);

CREATE INDEX IF NOT EXISTS project_snapshots_source_chapter_id_idx
ON project_snapshots(source_chapter_id);

CREATE INDEX IF NOT EXISTS project_snapshots_source_snapshot_id_idx
ON project_snapshots(source_snapshot_id);
