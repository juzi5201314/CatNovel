import assert from "node:assert/strict";
import test from "node:test";

import { resolveInitialDefaultSelection } from "../../src/core/llm/initial-default-selection.ts";

test("prefer builtin default preset ids for new projects", () => {
  const providers = [
    { id: "builtin_openai_compatible", enabled: true, apiKeyRef: null },
    { id: "builtin_embedding", enabled: true, apiKeyRef: null },
  ];

  const presets = [
    {
      id: "preset_chat_completions_default",
      providerId: "builtin_openai_compatible",
      purpose: "chat" as const,
      isBuiltin: true,
      createdAt: 1000,
    },
    {
      id: "preset_embedding_default",
      providerId: "builtin_embedding",
      purpose: "embedding" as const,
      isBuiltin: true,
      createdAt: 1000,
    },
  ];

  const result = resolveInitialDefaultSelection(presets, providers);
  assert.equal(result.defaultChatPresetId, "preset_chat_completions_default");
  assert.equal(result.defaultEmbeddingPresetId, "preset_embedding_default");
});

test("fallback chooses newest enabled preset and prefers provider without stored secret", () => {
  const providers = [
    { id: "chat_old", enabled: true, apiKeyRef: "secret-old" },
    { id: "chat_new", enabled: true, apiKeyRef: null },
    { id: "embed_old", enabled: true, apiKeyRef: "secret-embed-old" },
    { id: "embed_new", enabled: true, apiKeyRef: null },
  ];

  const presets = [
    {
      id: "chat-legacy",
      providerId: "chat_old",
      purpose: "chat" as const,
      isBuiltin: false,
      createdAt: 100,
    },
    {
      id: "chat-latest",
      providerId: "chat_new",
      purpose: "chat" as const,
      isBuiltin: false,
      createdAt: 200,
    },
    {
      id: "embedding-legacy",
      providerId: "embed_old",
      purpose: "embedding" as const,
      isBuiltin: false,
      createdAt: 110,
    },
    {
      id: "embedding-latest",
      providerId: "embed_new",
      purpose: "embedding" as const,
      isBuiltin: false,
      createdAt: 210,
    },
  ];

  const result = resolveInitialDefaultSelection(presets, providers);
  assert.equal(result.defaultChatPresetId, "chat-latest");
  assert.equal(result.defaultEmbeddingPresetId, "embedding-latest");
});
