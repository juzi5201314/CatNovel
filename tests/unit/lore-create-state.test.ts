import assert from "node:assert/strict";
import test from "node:test";

import {
  LORE_NODE_NAME_INPUT_LABEL,
  resolveLoreSelectionAfterLoad,
  shouldShowLoreEmptyCreateCta,
  shouldShowLoreRootCreateInput,
} from "../../src/components/lore/lore-create-state.ts";

test("lore root create input is shown for empty state after entering create mode", () => {
  assert.equal(
    shouldShowLoreRootCreateInput({
      loading: false,
      nodeCount: 0,
      creatingChildOf: null,
    }),
    true,
  );
});

test("lore empty create cta is shown before create mode starts", () => {
  assert.equal(
    shouldShowLoreEmptyCreateCta({
      loading: false,
      nodeCount: 0,
      creatingChildOf: "pending",
    }),
    true,
  );
});

test("lore root create input remains available for non-empty tree root creation", () => {
  assert.equal(
    shouldShowLoreRootCreateInput({
      loading: false,
      nodeCount: 2,
      creatingChildOf: null,
    }),
    true,
  );
});

test("lore root create input stays hidden while initial loading is in progress", () => {
  assert.equal(
    shouldShowLoreRootCreateInput({
      loading: true,
      nodeCount: 0,
      creatingChildOf: null,
    }),
    false,
  );
});

test("lore create inputs share a stable accessible label", () => {
  assert.equal(LORE_NODE_NAME_INPUT_LABEL, "节点名称");
});

test("lore selection reselects first root when current selection must be cleared", () => {
  const selection = resolveLoreSelectionAfterLoad({
    nodes: [
      { id: "root-b", parentId: null, sortOrder: 2 },
      { id: "root-a", parentId: null, sortOrder: 1 },
      { id: "child-a", parentId: "root-a", sortOrder: 1 },
    ],
    selectedNodeId: "child-a",
    preserveCurrentSelection: false,
  });

  assert.deepEqual(selection, {
    selectedNodeId: "root-a",
    expandedRootIds: ["root-a", "root-b"],
  });
});

test("lore selection keeps current selection when preserve mode is enabled", () => {
  const selection = resolveLoreSelectionAfterLoad({
    nodes: [{ id: "root-a", parentId: null, sortOrder: 1 }],
    selectedNodeId: "root-a",
    preserveCurrentSelection: true,
  });

  assert.equal(selection, null);
});

test("lore selection falls back to first root when preserved selection is stale", () => {
  const selection = resolveLoreSelectionAfterLoad({
    nodes: [
      { id: "root-a", parentId: null, sortOrder: 1 },
      { id: "root-b", parentId: null, sortOrder: 2 },
    ],
    selectedNodeId: "deleted-node",
    preserveCurrentSelection: true,
  });

  assert.deepEqual(selection, {
    selectedNodeId: "root-a",
    expandedRootIds: ["root-a", "root-b"],
  });
});
