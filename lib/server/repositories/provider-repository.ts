import { getDatabase } from "../../../db/client.ts";

export type ProviderProfile = {
  id: string;
  workId: string;
  family: "openai-compatible" | "gemini-native" | "claude-native" | "custom-endpoint";
  label: string;
  endpoint: string;
  model: string;
  apiKeyEnv: string;
  enabled: number;
};

export function listProviderProfiles(workId: string) {
  const db = getDatabase();

  return db.prepare(
    `SELECT
      id,
      work_id AS workId,
      family,
      label,
      endpoint,
      model,
      api_key_env AS apiKeyEnv,
      enabled
    FROM ai_provider_profiles
    WHERE work_id = ?
    ORDER BY created_at ASC`,
  ).all(workId) as ProviderProfile[];
}
