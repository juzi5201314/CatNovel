import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatLanguageModel,
  buildEmbeddingModel,
  createUserAgentOverrideFetch,
  normalizeModelBaseUrl,
} from "../../src/core/ai-runtime/model-factory.ts";

const baseInput = {
  providerId: "DeepSeek",
  modelId: "deepseek-chat",
  baseURL: "https://example.com/v1",
  apiKey: "test-key",
};

test("buildChatLanguageModel routes responses format to responses model", () => {
  const model = buildChatLanguageModel({
    ...baseInput,
    apiFormat: "responses",
  });
  const record = model as unknown as {
    provider?: string;
    specificationVersion?: string;
    modelId?: string;
  };

  assert.equal(record.provider, "deepseek.responses");
  assert.equal(record.specificationVersion, "v3");
  assert.equal(record.modelId, "deepseek-chat");
});

test("buildChatLanguageModel routes chat_completions format to chat model", () => {
  const model = buildChatLanguageModel({
    ...baseInput,
    apiFormat: "chat_completions",
  });
  const record = model as unknown as {
    provider?: string;
    specificationVersion?: string;
    modelId?: string;
  };

  assert.equal(record.provider, "deepseek.chat");
  assert.equal(record.specificationVersion, "v2");
  assert.equal(record.modelId, "deepseek-chat");
});

test("buildChatLanguageModel enables fetch override when custom user-agent is set", () => {
  const model = buildChatLanguageModel({
    ...baseInput,
    customUserAgent: "CatNovel-UA-Test/1.0",
    apiFormat: "responses",
  });

  const modelFetch = (model as { config?: { fetch?: unknown } }).config?.fetch;
  assert.equal(typeof modelFetch, "function");
});

test("createUserAgentOverrideFetch enforces exact user-agent value", async () => {
  let capturedRequest: Request | null = null;
  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedRequest = new Request(input, init);
    return new Response("{}", {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  };

  const wrappedFetch = createUserAgentOverrideFetch("CatNovel-UA-Test/1.0", fakeFetch);
  assert.equal(typeof wrappedFetch, "function");

  await wrappedFetch?.("https://example.com/v1/responses", {
    method: "POST",
    headers: {
      "user-agent": "ai-sdk/openai/3.0.39",
      "x-test-header": "ok",
    },
    body: "{}",
  });

  assert.ok(capturedRequest);
  const request = capturedRequest as Request;
  assert.equal(request.headers.get("user-agent"), "CatNovel-UA-Test/1.0");
  assert.equal(request.headers.get("x-test-header"), "ok");
});

test("createUserAgentOverrideFetch injects store=false for responses body", async () => {
  let capturedRequest: Request | null = null;
  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedRequest = new Request(input, init);
    return new Response("{}", {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  };

  const wrappedFetch = createUserAgentOverrideFetch(undefined, fakeFetch, {
    responsesStoreDefault: false,
  });
  assert.equal(typeof wrappedFetch, "function");

  await wrappedFetch?.("https://example.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      input: [{ role: "user", content: "hello" }],
    }),
  });

  assert.ok(capturedRequest);
  const request = capturedRequest as Request;
  const payload = JSON.parse(await request.text()) as Record<string, unknown>;
  assert.equal(payload.store, false);
});

test("createUserAgentOverrideFetch keeps explicit store=false unchanged", async () => {
  let capturedRequest: Request | null = null;
  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedRequest = new Request(input, init);
    return new Response("{}", {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  };

  const wrappedFetch = createUserAgentOverrideFetch(undefined, fakeFetch, {
    responsesStoreDefault: false,
  });
  assert.equal(typeof wrappedFetch, "function");

  await wrappedFetch?.("https://example.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      store: false,
      input: [{ role: "user", content: "hello" }],
    }),
  });

  assert.ok(capturedRequest);
  const request = capturedRequest as Request;
  const payload = JSON.parse(await request.text()) as Record<string, unknown>;
  assert.equal(payload.store, false);
});

test("createUserAgentOverrideFetch keeps explicit store=true unchanged", async () => {
  let capturedRequest: Request | null = null;
  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedRequest = new Request(input, init);
    return new Response("{}", {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  };

  const wrappedFetch = createUserAgentOverrideFetch(undefined, fakeFetch, {
    responsesStoreDefault: false,
  });
  assert.equal(typeof wrappedFetch, "function");

  await wrappedFetch?.("https://example.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      store: true,
      input: [{ role: "user", content: "hello" }],
    }),
  });

  assert.ok(capturedRequest);
  const request = capturedRequest as Request;
  const payload = JSON.parse(await request.text()) as Record<string, unknown>;
  assert.equal(payload.store, true);
});

test("normalizeModelBaseUrl strips explicit endpoint suffix", () => {
  assert.equal(
    normalizeModelBaseUrl("https://example.com/v1/chat/completions"),
    "https://example.com/v1",
  );
  assert.equal(
    normalizeModelBaseUrl("https://example.com/v1/responses"),
    "https://example.com/v1",
  );
  assert.equal(
    normalizeModelBaseUrl("https://example.com/v1/embeddings"),
    "https://example.com/v1",
  );
});

test("buildEmbeddingModel rejects non-openai-compatible protocol", () => {
  assert.throws(() => {
    buildEmbeddingModel({
      providerId: "test_provider",
      providerProtocol: "openai_responses",
      modelId: "text-embedding-3-large",
      baseURL: "https://example.com/v1",
      apiKey: "test-key",
    });
  });
});
