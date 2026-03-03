import assert from "node:assert/strict";
import test from "node:test";

import { resolveResponsesStepProviderOptions } from "../../src/core/ai-runtime/responses-step-options.ts";

test("returns undefined for non-responses api format", () => {
  const output = resolveResponsesStepProviderOptions("chat_completions", [
    { response: { id: "resp_1" } },
  ]);
  assert.equal(output, undefined);
});

test("returns undefined when previous response id is missing", () => {
  const output = resolveResponsesStepProviderOptions("responses", [{ response: {} }]);
  assert.equal(output, undefined);
});

test("returns undefined even when responses api format has response ids", () => {
  const output = resolveResponsesStepProviderOptions("responses", [
    { response: { id: "resp_old" } },
    { response: { id: "resp_new" } },
  ]);

  assert.equal(output, undefined);
});
