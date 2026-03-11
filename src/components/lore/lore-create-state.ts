export const LORE_NODE_NAME_INPUT_LABEL = "节点名称";

type LoreSelectionNode = {
  id: string;
  parentId: string | null;
  sortOrder: number;
};

export function shouldShowLoreRootCreateInput(input: {
  loading: boolean;
  nodeCount: number;
  creatingChildOf: string | null | undefined;
}): boolean {
  if (input.loading && input.nodeCount === 0) {
    return false;
  }
  return input.creatingChildOf === null;
}

export function shouldShowLoreEmptyCreateCta(input: {
  loading: boolean;
  nodeCount: number;
  creatingChildOf: string | null | undefined;
}): boolean {
  return !input.loading && input.nodeCount === 0 && input.creatingChildOf !== null;
}

export function resolveLoreSelectionAfterLoad(input: {
  nodes: LoreSelectionNode[];
  selectedNodeId: string | null | undefined;
  preserveCurrentSelection: boolean;
}): {
  selectedNodeId: string | null;
  expandedRootIds: string[];
} | null {
  if (input.nodes.length === 0) {
    return null;
  }

  const effectiveSelectedNodeId = input.preserveCurrentSelection ? input.selectedNodeId : null;
  if (effectiveSelectedNodeId && input.nodes.some((node) => node.id === effectiveSelectedNodeId)) {
    return null;
  }

  const roots = input.nodes
    .filter((node) => !node.parentId)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const firstNode = roots[0] ?? input.nodes[0] ?? null;
  if (!firstNode) {
    return null;
  }

  return {
    selectedNodeId: firstNode.id,
    expandedRootIds: roots.map((node) => node.id),
  };
}
