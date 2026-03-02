import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { projects } from "@/db/schema/projects";

export const PROVIDER_PROTOCOLS = ["openai_compatible", "openai_responses"] as const;
export const PROVIDER_CATEGORIES = ["chat", "embedding", "both"] as const;
export const MODEL_PRESET_PURPOSES = ["chat", "embedding"] as const;
export const MODEL_API_FORMATS = ["chat_completions", "responses", "embeddings"] as const;
export const THINKING_BUDGET_TYPES = ["effort", "tokens"] as const;
export const THINKING_EFFORT_LEVELS = ["low", "medium", "high"] as const;

export type ProviderProtocol = (typeof PROVIDER_PROTOCOLS)[number];
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];
export type ModelPresetPurpose = (typeof MODEL_PRESET_PURPOSES)[number];
export type ModelApiFormat = (typeof MODEL_API_FORMATS)[number];
export type ThinkingBudgetType = (typeof THINKING_BUDGET_TYPES)[number];
export type ThinkingEffortLevel = (typeof THINKING_EFFORT_LEVELS)[number];
export type PresetPurpose = ModelPresetPurpose;
export type PresetApiFormat = ModelApiFormat;
export type ThinkingEffort = ThinkingEffortLevel;

export const llmProviders = sqliteTable(
  "llm_providers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    protocol: text("protocol", { enum: PROVIDER_PROTOCOLS }).$type<ProviderProtocol>().notNull(),
    category: text("category", { enum: PROVIDER_CATEGORIES }).$type<ProviderCategory>().notNull(),
    baseUrl: text("base_url").notNull(),
    apiKeyRef: text("api_key_ref"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    isBuiltin: integer("is_builtin", { mode: "boolean" }).notNull().default(false),
    builtinCode: text("builtin_code"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    nameLengthCheck: check("llm_providers_name_length_check", sql`length(${table.name}) >= 1`),
    builtinCodeIdx: index("llm_providers_builtin_code_idx").on(table.builtinCode),
  }),
);

export const llmModelPresets = sqliteTable(
  "llm_model_presets",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => llmProviders.id, { onDelete: "cascade" }),
    purpose: text("purpose", { enum: MODEL_PRESET_PURPOSES }).$type<ModelPresetPurpose>().notNull(),
    apiFormat: text("api_format", { enum: MODEL_API_FORMATS }).$type<ModelApiFormat>().notNull(),
    modelId: text("model_id").notNull(),
    temperature: real("temperature"),
    maxTokens: integer("max_tokens"),
    thinkingBudgetType: text("thinking_budget_type", { enum: THINKING_BUDGET_TYPES }).$type<ThinkingBudgetType>(),
    thinkingEffort: text("thinking_effort", { enum: THINKING_EFFORT_LEVELS }).$type<ThinkingEffortLevel>(),
    thinkingTokens: integer("thinking_tokens"),
    isBuiltin: integer("is_builtin", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    providerPurposeIdx: index("llm_model_presets_provider_purpose_idx").on(table.providerId, table.purpose),
  }),
);

export const llmDefaultSelection = sqliteTable(
  "llm_default_selection",
  {
    projectId: text("project_id")
      .primaryKey()
      .references(() => projects.id, { onDelete: "cascade" }),
    defaultChatPresetId: text("default_chat_preset_id").references(() => llmModelPresets.id, {
      onDelete: "set null",
    }),
    defaultEmbeddingPresetId: text("default_embedding_preset_id").references(() => llmModelPresets.id, {
      onDelete: "set null",
    }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    chatPresetIdx: index("llm_default_selection_chat_idx").on(table.defaultChatPresetId),
    embeddingPresetIdx: index("llm_default_selection_embedding_idx").on(table.defaultEmbeddingPresetId),
  }),
);

export type LlmProviderRow = typeof llmProviders.$inferSelect;
export type NewLlmProviderRow = typeof llmProviders.$inferInsert;
export type LlmModelPresetRow = typeof llmModelPresets.$inferSelect;
export type NewLlmModelPresetRow = typeof llmModelPresets.$inferInsert;
export type LlmDefaultSelectionRow = typeof llmDefaultSelection.$inferSelect;
export type NewLlmDefaultSelectionRow = typeof llmDefaultSelection.$inferInsert;
