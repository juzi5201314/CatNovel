import { getDatabase } from "../db/client.ts";

const db = getDatabase();

const testModelPatterns = ['broken-model', 'story-model', 'ghost-model'];

for (const pattern of testModelPatterns) {
  const profiles = db
    .prepare(`
      SELECT id, label, model_ids_json 
      FROM ai_provider_profiles 
      WHERE model_ids_json LIKE ?
    `)
    .all(`%${pattern}%`);

  for (const row of profiles as Array<{ id: string; label: string; model_ids_json: string }>) {
    console.log(`Found test profile: ${row.label} (${row.id}) with models: ${row.model_ids_json}`);
    
    db.prepare('DELETE FROM ai_provider_profiles WHERE id = ?').run(row.id);
    console.log(`  Deleted: ${row.id}`);
  }
}

console.log('Cleanup complete.');
