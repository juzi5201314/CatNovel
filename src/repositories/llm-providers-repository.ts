import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import {
  llmProviders,
  type ProviderCategory,
  type ProviderProtocol,
} from "@/db/schema";

import { BaseRepository } from "./base-repository";

export type ProviderRecord = {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  category: ProviderCategory;
  baseUrl: string;
  apiKeyRef?: string | null;
  enabled?: boolean;
  isBuiltin?: boolean;
  builtinCode?: string | null;
};

export class LlmProvidersRepository extends BaseRepository {
  constructor(database?: AppDatabase) {
    super(database);
  }

  list() {
    return this.db.select().from(llmProviders).orderBy(llmProviders.createdAt).all();
  }

  findById(id: string) {
    const row = this.db
      .select()
      .from(llmProviders)
      .where(eq(llmProviders.id, id))
      .get();
    return row ?? null;
  }

  upsert(record: ProviderRecord): ProviderRecord {
    this.db
      .insert(llmProviders)
      .values({
        id: record.id,
        name: record.name,
        protocol: record.protocol,
        category: record.category,
        baseUrl: record.baseUrl,
        apiKeyRef: record.apiKeyRef ?? null,
        enabled: record.enabled ?? true,
        isBuiltin: record.isBuiltin ?? false,
        builtinCode: record.builtinCode ?? null,
      })
      .onConflictDoUpdate({
        target: llmProviders.id,
        set: {
          name: record.name,
          protocol: record.protocol,
          category: record.category,
          baseUrl: record.baseUrl,
          apiKeyRef: record.apiKeyRef ?? null,
          enabled: record.enabled ?? true,
          isBuiltin: record.isBuiltin ?? false,
          builtinCode: record.builtinCode ?? null,
          updatedAt: new Date(),
        },
      })
      .run();

    return {
      ...record,
      enabled: record.enabled ?? true,
      isBuiltin: record.isBuiltin ?? false,
      apiKeyRef: record.apiKeyRef ?? null,
      builtinCode: record.builtinCode ?? null,
    };
  }

  deleteById(id: string): boolean {
    const result = this.db.delete(llmProviders).where(eq(llmProviders.id, id)).run();
    return result.changes > 0;
  }
}
