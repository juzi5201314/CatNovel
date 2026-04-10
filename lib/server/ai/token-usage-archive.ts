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

let tokenUsageRecords: TokenUsageRecord[] = [];
let nextTokenRecordSequence = 1;

export function archiveTokenUsage(
  record: Omit<TokenUsageRecord, 'id' | 'createdAt'>,
): TokenUsageRecord {
  const nextRecord: TokenUsageRecord = {
    ...record,
    id: `token-record-${nextTokenRecordSequence++}`,
    createdAt: new Date().toISOString(),
  };

  tokenUsageRecords = [nextRecord, ...tokenUsageRecords];
  return nextRecord;
}

export function listTokenUsageRecords(): TokenUsageRecord[] {
  return tokenUsageRecords.map((record) => ({ ...record }));
}

export function resetTokenUsageArchiveForTests() {
  tokenUsageRecords = [];
  nextTokenRecordSequence = 1;
}
