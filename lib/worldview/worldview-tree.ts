import type { SettingNodeRecord, WorldviewNodeType } from '@/lib/contracts/workspace';
import type { WorldviewPayload } from './worldview-payload';
import { parseWorldviewPayload } from './worldview-payload';

export interface WorldviewTreeNode {
  id: string;
  workId: string;
  parentId: string | null;
  nodeType: SettingNodeRecord['nodeType'];
  sortIndex: number;
  title: string;
  payloadJson: string;
  createdAt: string;
  updatedAt: string;
  children: WorldviewTreeNode[];
  payload: WorldviewPayload;
  depth: number;
}

export function buildWorldviewTree(
  nodes: SettingNodeRecord[]
): WorldviewTreeNode[] {
  const nodeMap = new Map<string, WorldviewTreeNode>();
  const roots: WorldviewTreeNode[] = [];

  // First pass: create nodes with payload
  for (const node of nodes) {
    nodeMap.set(node.id, {
      ...node,
      children: [],
      payload: parseWorldviewPayload(node.payloadJson),
      depth: 0,
    });
  }

  // Second pass: build parent-child relationships
  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;

    if (node.parentId === null) {
      roots.push(treeNode);
    } else {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        treeNode.depth = parent.depth + 1;
        parent.children.push(treeNode);
      } else {
        // Orphan node - treat as root
        roots.push(treeNode);
      }
    }
  }

  // Sort roots and children by sortIndex
  roots.sort((a, b) => a.sortIndex - b.sortIndex);
  for (const node of nodeMap.values()) {
    node.children.sort((a, b) => a.sortIndex - b.sortIndex);
  }

  return roots;
}

export function flattenWorldviewTree(
  tree: WorldviewTreeNode[]
): SettingNodeRecord[] {
  const result: SettingNodeRecord[] = [];

  function traverse(nodes: WorldviewTreeNode[]) {
    for (const node of nodes) {
      const { children, payload, depth, ...record } = node;
      result.push(record);
      traverse(children);
    }
  }

  traverse(tree);
  return result;
}

export function findNodeInTree(
  tree: WorldviewTreeNode[],
  nodeId: string
): WorldviewTreeNode | null {
  for (const node of tree) {
    if (node.id === nodeId) {
      return node;
    }
    const found = findNodeInTree(node.children, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

export function getNodePath(
  tree: WorldviewTreeNode[],
  nodeId: string
): WorldviewTreeNode[] {
  const path: WorldviewTreeNode[] = [];

  function search(nodes: WorldviewTreeNode[]): boolean {
    for (const node of nodes) {
      if (node.id === nodeId) {
        path.push(node);
        return true;
      }
      if (search(node.children)) {
        path.unshift(node);
        return true;
      }
    }
    return false;
  }

  search(tree);
  return path;
}

export function getAllDescendants(
  node: WorldviewTreeNode
): WorldviewTreeNode[] {
  const descendants: WorldviewTreeNode[] = [];

  function collect(n: WorldviewTreeNode) {
    for (const child of n.children) {
      descendants.push(child);
      collect(child);
    }
  }

  collect(node);
  return descendants;
}

export function searchWorldviewTree(
  tree: WorldviewTreeNode[],
  query: string
): WorldviewTreeNode[] {
  const lowerQuery = query.toLowerCase();
  const results: WorldviewTreeNode[] = [];

  function search(nodes: WorldviewTreeNode[]) {
    for (const node of nodes) {
      const matchTitle = node.title.toLowerCase().includes(lowerQuery);
      const matchPayload =
        node.payload.note?.toLowerCase().includes(lowerQuery) ||
        node.payload.value?.toLowerCase().includes(lowerQuery);

      if (matchTitle || matchPayload) {
        results.push(node);
      }

      search(node.children);
    }
  }

  search(tree);
  return results;
}

export interface WorldviewOutlineItem {
  id: string;
  title: string;
  type: WorldviewNodeType;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

export function buildWorldviewOutline(
  tree: WorldviewTreeNode[],
  expandedIds: Set<string> = new Set()
): WorldviewOutlineItem[] {
  const outline: WorldviewOutlineItem[] = [];

  function traverse(nodes: WorldviewTreeNode[], depth: number) {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      const expanded = expandedIds.has(node.id);

      outline.push({
        id: node.id,
        title: node.title,
        type: node.nodeType as WorldviewNodeType,
        depth,
        hasChildren,
        expanded,
      });

      if (hasChildren && expanded) {
        traverse(node.children, depth + 1);
      }
    }
  }

  traverse(tree, 0);
  return outline;
}
