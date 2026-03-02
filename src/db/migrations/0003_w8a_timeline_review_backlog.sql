PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS timeline_review_backlog (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  reason TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  fingerprint TEXT,
  source TEXT NOT NULL DEFAULT 'llm_low_confidence',
  queued_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  processed_at INTEGER,
  processed_by TEXT,
  decision_note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  CHECK (status IN ('queued', 'confirmed', 'rejected', 'resolved')),
  CHECK (length(reason) >= 1),
  CHECK (length(source) >= 1),
  CHECK (confidence >= 0 AND confidence <= 1),
  CHECK (status = 'queued' OR processed_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS timeline_review_backlog_event_id_uidx
ON timeline_review_backlog(event_id);

CREATE INDEX IF NOT EXISTS timeline_review_backlog_project_status_queued_at_idx
ON timeline_review_backlog(project_id, status, queued_at);

CREATE INDEX IF NOT EXISTS timeline_review_backlog_chapter_id_idx
ON timeline_review_backlog(chapter_id);

CREATE INDEX IF NOT EXISTS timeline_review_backlog_fingerprint_idx
ON timeline_review_backlog(fingerprint);
