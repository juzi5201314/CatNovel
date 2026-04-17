export const canonicalTables = [
  "works",
  "volumes",
  "chapters",
  "chapter_order",
  "settings_nodes",
  "book_metadata",
  "snapshots",
  "snapshot_items",
  "chat_sessions",
  "chat_messages",
  "chat_message_versions",
  "ai_provider_profiles",
  "context_selections",
  "chapter_summaries",
  "generation_archive",
  "token_usage_records",
  "app_preferences",
  "import_jobs",
  "export_jobs",
] as const;

export type CanonicalTable = (typeof canonicalTables)[number];

export const schemaMigrations = [
  {
    id: "0001_canonical_schema",
    statements: [
      `CREATE TABLE IF NOT EXISTS works (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        locale TEXT NOT NULL DEFAULT 'zh',
        synopsis TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS volumes (
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        title TEXT NOT NULL,
        sort_index INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS chapters (
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
      )`,
      `CREATE TABLE IF NOT EXISTS chapter_order (
        work_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        sort_index INTEGER NOT NULL,
        PRIMARY KEY (work_id, chapter_id),
        FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS settings_nodes (
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        parent_id TEXT,
        node_type TEXT NOT NULL,
        title TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS book_metadata (
        work_id TEXT PRIMARY KEY,
        author_name TEXT NOT NULL DEFAULT '',
        premise TEXT NOT NULL DEFAULT '',
        target_readers TEXT NOT NULL DEFAULT '',
        serialized_status TEXT NOT NULL DEFAULT 'ongoing',
        tags_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS snapshot_items (
        id TEXT PRIMARY KEY,
        snapshot_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        item_key TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        body TEXT NOT NULL,
        tps REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS ai_provider_profiles (
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        family TEXT NOT NULL,
        label TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        model TEXT NOT NULL,
        model_ids_json TEXT NOT NULL DEFAULT '[]',
        api_key_env TEXT NOT NULL,
        api_key TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS context_selections (
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        chapter_id TEXT,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS chapter_summaries (
        chapter_id TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS generation_archive (
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        chapter_id TEXT,
        task_class TEXT NOT NULL,
        provider_profile_id TEXT NOT NULL,
        prompt_excerpt TEXT NOT NULL,
        response_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS token_usage_records (
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        provider_profile_id TEXT NOT NULL,
        model_id TEXT NOT NULL DEFAULT '',
        task_class TEXT NOT NULL DEFAULT '',
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS app_preferences (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS import_jobs (
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        source_format TEXT NOT NULL,
        status TEXT NOT NULL,
        log_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS export_jobs (
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        target_format TEXT NOT NULL,
        status TEXT NOT NULL,
        output_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )`,
    ],
  },
  {
    id: "0002_workspace_metrics",
    statements: [
      `ALTER TABLE works ADD COLUMN synopsis TEXT NOT NULL DEFAULT ''`,
      `CREATE TABLE IF NOT EXISTS volumes (
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        title TEXT NOT NULL,
        sort_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
      )`,
      `ALTER TABLE chapters ADD COLUMN plaintext TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE chapters ADD COLUMN character_count INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE chapters ADD COLUMN reading_minutes INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE chapters ADD COLUMN last_autosaved_at TEXT`,
      `UPDATE chapters
         SET plaintext = CASE
             WHEN plaintext = '' THEN excerpt
             ELSE plaintext
           END,
             character_count = CASE
               WHEN character_count = 0 THEN length(CASE WHEN plaintext = '' THEN excerpt ELSE plaintext END)
               ELSE character_count
             END,
             reading_minutes = CASE
               WHEN reading_minutes = 0 THEN CASE
                 WHEN word_count <= 0 THEN 1
                 ELSE CAST((word_count + 199) / 200 AS INTEGER)
               END
               ELSE reading_minutes
             END,
             last_autosaved_at = COALESCE(last_autosaved_at, updated_at)`,
      `INSERT OR IGNORE INTO volumes (id, work_id, title, sort_index, created_at, updated_at)
         SELECT DISTINCT volume_id, work_id,
           CASE volume_id WHEN 'volume-1' THEN '第一卷 迷雾城' ELSE volume_id END,
           0,
           created_at,
           updated_at
         FROM chapters`,
    ],
  },
  {
    id: "0003_ai_profile_and_usage_fields",
    statements: [
      `ALTER TABLE ai_provider_profiles ADD COLUMN model_ids_json TEXT NOT NULL DEFAULT '[]'`,
      `ALTER TABLE ai_provider_profiles ADD COLUMN api_key TEXT NOT NULL DEFAULT ''`,
      `UPDATE ai_provider_profiles
         SET model_ids_json = CASE
           WHEN model_ids_json = '[]' THEN json_array(model)
           ELSE model_ids_json
         END`,
      `UPDATE ai_provider_profiles
         SET api_key = CASE
           WHEN api_key = '' THEN api_key_env
           ELSE api_key
         END`,
      `ALTER TABLE token_usage_records ADD COLUMN model_id TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE token_usage_records ADD COLUMN task_class TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE token_usage_records ADD COLUMN total_tokens INTEGER NOT NULL DEFAULT 0`,
      `UPDATE token_usage_records
         SET total_tokens = CASE
           WHEN total_tokens = 0 THEN prompt_tokens + completion_tokens
           ELSE total_tokens
         END`,
    ],
  },
  {
    id: "0004_worldview_nodes",
    statements: [
      `ALTER TABLE settings_nodes ADD COLUMN sort_index INTEGER NOT NULL DEFAULT 0`,
      `UPDATE settings_nodes SET node_type = 'group'`,
      `CREATE INDEX IF NOT EXISTS idx_settings_nodes_work_parent_sort
         ON settings_nodes (work_id, parent_id, sort_index, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_settings_nodes_work_title
         ON settings_nodes (work_id, title)`,
    ],
  },
  {
    id: "0005_rename_token_count_to_tps",
    statements: [
      `ALTER TABLE chat_messages RENAME COLUMN token_count TO tps`,
    ],
  },
  {
    id: "0006_chat_message_versions",
    statements: [
      `CREATE TABLE IF NOT EXISTS chat_message_versions (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        body TEXT NOT NULL,
        tps REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_chat_message_versions_message_id
         ON chat_message_versions (message_id)`,
      `ALTER TABLE chat_messages ADD COLUMN active_version_id TEXT`,
    ],
  },
] as const;

export const seedStatements = [
  `INSERT OR IGNORE INTO works (id, title, locale, synopsis, created_at, updated_at)
   VALUES ('work-default', 'CatNovel Demo', 'zh', '一个围绕都市异闻与写作现场展开的长篇网文工作区。', '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z')`,
  `INSERT OR IGNORE INTO settings_nodes (id, work_id, parent_id, node_type, sort_index, title, payload_json, created_at, updated_at)
   VALUES
    ('setting-characters', 'work-default', NULL, 'group', 0, '角色', '{"schemaVersion":1,"note":"主角、盟友与反派的动机与关系"}', '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z'),
    ('setting-factions', 'work-default', NULL, 'group', 1, '势力', '{"schemaVersion":1,"note":"故事中的组织、阵营与势力分布"}', '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z'),
    ('setting-locations', 'work-default', NULL, 'group', 2, '地点', '{"schemaVersion":1,"note":"书中存在的地点与场景"}', '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z'),
    ('setting-items', 'work-default', NULL, 'group', 3, '物品', '{"schemaVersion":1,"note":"故事中的道具、神器与关键物品"}', '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z'),
    ('setting-rules', 'work-default', NULL, 'group', 4, '世界规则', '{"schemaVersion":1,"note":"力量体系、设定与禁忌条款"}', '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z')`,
] as const;
