import assert from "node:assert/strict";
import test from "node:test";

import {
  assertToolApprovalTransition,
  canTransitToolApproval,
} from "../../src/core/tools/tool-approval-state-machine.ts";

test("tool approval transition allows pending -> approved", () => {
  assert.equal(canTransitToolApproval("pending", "approved"), true);
});

test("tool approval transition rejects executed -> approved", () => {
  assert.equal(canTransitToolApproval("executed", "approved"), false);
});

test("assertToolApprovalTransition throws for invalid transition", () => {
  assert.throws(
    () => assertToolApprovalTransition("rejected", "approved"),
    /invalid tool approval transition/,
  );
});
