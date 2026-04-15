import { getDatabase } from '../../../db/client.ts';

export function getPreference(key: string): string | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT value_json FROM app_preferences WHERE key = ?')
    .get(key) as { value_json: string } | undefined;

  return row?.value_json ?? null;
}

export function setPreference(key: string, value: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO app_preferences (key, value_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
  ).run(key, value, now);
}
