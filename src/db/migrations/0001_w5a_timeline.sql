PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  CHECK (length(name) >= 1),
  CHECK (length(normalized_name) >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS entities_project_normalized_name_uidx
ON entities(project_id, normalized_name);

CREATE INDEX IF NOT EXISTS entities_project_type_idx
ON entities(project_id, type);

CREATE TABLE IF NOT EXISTS entity_aliases (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  CHECK (length(alias) >= 1),
  CHECK (length(normalized_alias) >= 1),
  CHECK (is_primary IN (0, 1))
);

CREATE UNIQUE INDEX IF NOT EXISTS entity_aliases_project_normalized_alias_uidx
ON entity_aliases(project_id, normalized_alias);

CREATE INDEX IF NOT EXISTS entity_aliases_entity_id_idx
ON entity_aliases(entity_id);

CREATE INDEX IF NOT EXISTS entity_aliases_project_entity_idx
ON entity_aliases(project_id, entity_id);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  chapter_order INTEGER NOT NULL,
  sequence_no INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  summary TEXT,
  evidence TEXT,
  confidence REAL NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  dedupe_key TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  CHECK (chapter_order >= 0),
  CHECK (sequence_no >= 0),
  CHECK (length(title) >= 1),
  CHECK (confidence >= 0 AND confidence <= 1),
  CHECK (version >= 1),
  CHECK (status IN ('auto', 'confirmed', 'rejected', 'pending_review'))
);

CREATE UNIQUE INDEX IF NOT EXISTS events_project_dedupe_key_uidx
ON events(project_id, dedupe_key);

CREATE INDEX IF NOT EXISTS events_project_chapter_order_idx
ON events(project_id, chapter_order, sequence_no);

CREATE INDEX IF NOT EXISTS events_project_status_idx
ON events(project_id, status);

CREATE INDEX IF NOT EXISTS events_chapter_id_idx
ON events(chapter_id);

CREATE TABLE IF NOT EXISTS event_entities (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'subject',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (event_id, entity_id),
  CHECK (length(role) >= 1)
);

CREATE INDEX IF NOT EXISTS event_entities_entity_id_idx
ON event_entities(entity_id);

CREATE INDEX IF NOT EXISTS event_entities_event_id_idx
ON event_entities(event_id);

CREATE TABLE IF NOT EXISTS timeline_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  snapshot_type TEXT NOT NULL,
  event_version INTEGER,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  CHECK (snapshot_type IN ('event_upsert', 'chapter_rebuild')),
  CHECK (event_version IS NULL OR event_version >= 1)
);

CREATE INDEX IF NOT EXISTS timeline_snapshots_project_created_at_idx
ON timeline_snapshots(project_id, created_at);

CREATE INDEX IF NOT EXISTS timeline_snapshots_event_id_idx
ON timeline_snapshots(event_id);

CREATE INDEX IF NOT EXISTS timeline_snapshots_chapter_id_idx
ON timeline_snapshots(chapter_id);
