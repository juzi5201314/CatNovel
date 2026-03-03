import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import {
  llmModelPresets,
  type PresetChatApiFormat,
  type PresetPurpose,
  type ThinkingBudgetType,
  type ThinkingEffort,
} from "@/db/schema";

import { BaseRepository } from "./base-repository";

export type ModelPresetRecord = {
  id: string;
  providerId: string;
  purpose: PresetPurpose;
  chatApiFormat?: PresetChatApiFormat | null;
  modelId: string;
  customUserAgent?: string | null;
  temperature?: number;
  maxTokens?: number;
  thinkingBudgetType?: ThinkingBudgetType;
  thinkingEffort?: ThinkingEffort;
  thinkingTokens?: number;
  isBuiltin?: boolean;
};

export class LlmModelPresetsRepository extends BaseRepository {
  constructor(database?: AppDatabase) {
    super(database);
  }

  list() {
    return this.db
      .select()
      .from(llmModelPresets)
      .orderBy(llmModelPresets.createdAt)
      .all();
  }

  listByProvider(providerId: string) {
    return this.db
      .select()
      .from(llmModelPresets)
      .where(eq(llmModelPresets.providerId, providerId))
      .all();
  }

  findById(id: string) {
    const row = this.db
      .select()
      .from(llmModelPresets)
      .where(eq(llmModelPresets.id, id))
      .get();
    return row ?? null;
  }

  upsert(record: ModelPresetRecord): ModelPresetRecord {
    this.db
      .insert(llmModelPresets)
      .values({
        id: record.id,
        providerId: record.providerId,
        purpose: record.purpose,
        chatApiFormat: record.chatApiFormat ?? null,
        modelId: record.modelId,
        customUserAgent: record.customUserAgent ?? null,
        temperature: record.temperature,
        maxTokens: record.maxTokens,
        thinkingBudgetType: record.thinkingBudgetType,
        thinkingEffort: record.thinkingEffort,
        thinkingTokens: record.thinkingTokens,
        isBuiltin: record.isBuiltin ?? false,
      })
      .onConflictDoUpdate({
        target: llmModelPresets.id,
        set: {
          providerId: record.providerId,
          purpose: record.purpose,
          chatApiFormat: record.chatApiFormat ?? null,
          modelId: record.modelId,
          customUserAgent: record.customUserAgent ?? null,
          temperature: record.temperature,
          maxTokens: record.maxTokens,
          thinkingBudgetType: record.thinkingBudgetType,
          thinkingEffort: record.thinkingEffort,
          thinkingTokens: record.thinkingTokens,
          isBuiltin: record.isBuiltin ?? false,
          updatedAt: new Date(),
        },
      })
      .run();

    return {
      ...record,
      isBuiltin: record.isBuiltin ?? false,
    };
  }

  deleteById(id: string): boolean {
    const result = this.db
      .delete(llmModelPresets)
      .where(eq(llmModelPresets.id, id))
      .run();
    return result.changes > 0;
  }
}
