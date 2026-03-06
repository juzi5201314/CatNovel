-- Worldbuilding tree nodes: hierarchical settings/lore for each project.
-- parent_id = NULL means a root-level node (direct child of the project root).

CREATE TABLE IF NOT EXISTS worldbuilding_nodes (
  id            TEXT    PRIMARY KEY NOT NULL,
  project_id    TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id     TEXT    REFERENCES worldbuilding_nodes(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL CHECK(length(name) >= 1),
  description   TEXT    NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS wb_nodes_project_idx
  ON worldbuilding_nodes(project_id);

CREATE INDEX IF NOT EXISTS wb_nodes_parent_idx
  ON worldbuilding_nodes(parent_id);

CREATE INDEX IF NOT EXISTS wb_nodes_project_parent_sort_idx
  ON worldbuilding_nodes(project_id, parent_id, sort_order);
