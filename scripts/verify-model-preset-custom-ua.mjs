import assert from "node:assert/strict";

function asApiSuccess(payload) {
  return Boolean(payload && typeof payload === "object" && payload.success === true);
}

function readApiData(payload) {
  if (!asApiSuccess(payload)) {
    const message =
      payload && typeof payload === "object" && payload.error
        ? payload.error.message
        : "request failed";
    throw new Error(String(message));
  }
  return payload.data;
}

async function run() {
  const providersRepoModule = await import(
    "../src/repositories/llm-providers-repository.ts"
  );
  const LlmProvidersRepository = providersRepoModule.LlmProvidersRepository;
  assert.equal(typeof LlmProvidersRepository, "function", "providers repository should be available");

  const providersRepository = new LlmProvidersRepository();
  const provider = providersRepository
    .list()
    .find((item) => item.enabled && (item.category === "chat" || item.category === "both"));
  if (!provider) {
    throw new Error("no enabled chat-capable provider found");
  }

  const modelPresetsRoute = await import("../src/app/api/settings/model-presets/route.ts");
  const modelPresetItemRoute = await import("../src/app/api/settings/model-presets/[id]/route.ts");
  const createPreset = modelPresetsRoute.POST;
  const patchPreset = modelPresetItemRoute.PATCH;
  const deletePreset = modelPresetItemRoute.DELETE;
  assert.equal(typeof createPreset, "function", "model presets POST route should be available");
  assert.equal(typeof patchPreset, "function", "model presets PATCH route should be available");
  assert.equal(typeof deletePreset, "function", "model presets DELETE route should be available");

  const customUserAgent = "CatNovel-Test-UA/1.0 (Preset-UA-Verify)";
  const modelId = `ua-test-${Date.now()}`;

  const createRequest = new Request("http://localhost/api/settings/model-presets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerId: provider.id,
      purpose: "chat",
      chatApiFormat: "chat_completions",
      modelId,
      customUserAgent,
    }),
  });
  const createdResponse = await createPreset(createRequest);
  const createdPayload = await createdResponse.json();
  const createdData = readApiData(createdPayload);
  assert.equal(createdData.customUserAgent, customUserAgent);

  const patchRequest = new Request(
    `http://localhost/api/settings/model-presets/${createdData.id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customUserAgent: null,
      }),
    },
  );
  const patchedResponse = await patchPreset(patchRequest, {
    params: Promise.resolve({ id: createdData.id }),
  });
  const patchedPayload = await patchedResponse.json();
  const patchedData = readApiData(patchedPayload);
  assert.equal(patchedData.customUserAgent, null);

  const deleteRequest = new Request(
    `http://localhost/api/settings/model-presets/${createdData.id}`,
    {
      method: "DELETE",
    },
  );
  const deletedResponse = await deletePreset(deleteRequest, {
    params: Promise.resolve({ id: createdData.id }),
  });
  const deletedPayload = await deletedResponse.json();
  readApiData(deletedPayload);

  console.log("verify_model_preset_custom_ua_ok=true");
  console.log(`provider_id=${provider.id}`);
  console.log(`created_preset_id=${createdData.id}`);
}

run().catch((error) => {
  console.error("verify_model_preset_custom_ua_ok=false");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
