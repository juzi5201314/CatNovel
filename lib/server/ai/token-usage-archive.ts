import { randomUUID } from 'node:crypto';

import { getDatabase } from '../../../db/client.ts';

export interface TokenUsageRecord {
  id: string;
  providerId: string;
  modelId: string;
  taskClass: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  createdAt: string;
}

export function archiveTokenUsage(
  record: Omit<TokenUsageRecord, 'id' | 'createdAt'> & { workId?: string },
): TokenUsageRecord {
  const id = `token-record-${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const totalTokens = record.totalTokens || record.inputTokens + record.outputTokens;

  getDatabase()
    .prepare(
      `INSERT INTO token_usage_records (
        id,
        work_id,
        provider_profile_id,
        model_id,
        task_class,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      record.workId ?? 'work-default',
      record.providerId,
      record.modelId,
      record.taskClass,
      record.inputTokens,
      record.outputTokens,
      totalTokens,
      createdAt,
    );

  return {
    id,
    providerId: record.providerId,
    modelId: record.modelId,
    taskClass: record.taskClass,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    totalTokens,
    createdAt,
  };
}

export function listTokenUsageRecords(): TokenUsageRecord[] {
  return getDatabase()
    .prepare(
      `SELECT
        id,
        provider_profile_id AS providerId,
        model_id AS modelId,
        task_class AS taskClass,
        prompt_tokens AS inputTokens,
        completion_tokens AS outputTokens,
        total_tokens AS totalTokens,
        created_at AS createdAt
      FROM token_usage_records
      ORDER BY created_at DESC`,
    )
    .all() as unknown as TokenUsageRecord[];
}

export function resetTokenUsageArchiveForTests() {
  getDatabase().prepare('DELETE FROM token_usage_records').run();
}
