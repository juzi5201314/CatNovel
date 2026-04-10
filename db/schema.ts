export const canonicalTables = [
  "works",
  "chapters",
  "chapter_order",
  "settings_nodes",
  "book_metadata",
  "snapshots",
  "snapshot_items",
  "chat_sessions",
  "chat_messages",
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
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        work_id TEXT NOT NULL,
        volume_id TEXT NOT NULL,
        title TEXT NOT NULL,
        body_json TEXT NOT NULL,
        excerpt TEXT NOT NULL DEFAULT '',
        word_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
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
        token_count INTEGER NOT NULL DEFAULT 0,
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
        api_key_env TEXT NOT NULL,
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
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
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
] as const;

export const seedStatements = [
  `INSERT OR IGNORE INTO works (id, title, locale, created_at, updated_at)
   VALUES ('work-default', 'CatNovel Demo', 'zh', '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z')`,
  `INSERT OR IGNORE INTO chapters (id, work_id, volume_id, title, body_json, excerpt, word_count, status, created_at, updated_at)
   VALUES
    ('chapter-1', 'work-default', 'volume-1', '第一章 雨夜开篇', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"雨落在旧城的玻璃顶棚上，像一场迟到的开场白。"}]}]}', '雨夜、旧城、主角初登场。', 23, 'draft', '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z'),
    ('chapter-2', 'work-default', 'volume-1', '第二章 误入禁区', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"她推开那扇不该打开的门，于是故事终于开始向深处滑去。"}]}]}', '推进冲突，进入主线区域。', 29, 'draft', '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z')`,
  `INSERT OR IGNORE INTO chapter_order (work_id, chapter_id, sort_index)
   VALUES ('work-default', 'chapter-1', 0), ('work-default', 'chapter-2', 1)`,
  `INSERT OR IGNORE INTO book_metadata (work_id, author_name, premise, target_readers, serialized_status, tags_json, updated_at)
   VALUES ('work-default', 'CatNovel', '一个围绕都市异闻与创作现场展开的长篇网文项目。', 'webnovel-core', 'ongoing', '["都市","悬疑","成长"]', '2026-04-10T00:00:00.000Z')`,
  `INSERT OR IGNORE INTO ai_provider_profiles (id, work_id, family, label, endpoint, model, api_key_env, enabled, created_at, updated_at)
   VALUES
    ('provider-openai', 'work-default', 'openai-compatible', 'OpenAI Compatible', 'https://api.openai.com/v1', 'gpt-4.1', 'OPENAI_API_KEY', 1, '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z'),
    ('provider-gemini', 'work-default', 'gemini-native', 'Gemini Native', 'https://generativelanguage.googleapis.com', 'gemini-2.5-pro', 'GEMINI_API_KEY', 1, '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z'),
    ('provider-claude', 'work-default', 'claude-native', 'Claude Native', 'https://api.anthropic.com', 'claude-sonnet-4-0', 'ANTHROPIC_API_KEY', 1, '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z'),
    ('provider-custom', 'work-default', 'custom-endpoint', 'Custom Endpoint', 'https://llm.example.com/v1', 'custom-model', 'CUSTOM_LLM_API_KEY', 0, '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z')`,
] as const;
