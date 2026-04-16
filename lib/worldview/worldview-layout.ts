import type { Node, Edge } from '@xyflow/react';
import type { WorldviewTreeNode } from './worldview-tree';
import { tree, hierarchy, type HierarchyNode, type HierarchyPointNode } from 'd3-hierarchy';

export interface LayoutedNode extends Node {
  position: { x: number; y: number };
}

interface TreeLayoutOptions {
  direction?: 'DOWN' | 'RIGHT';
  nodeWidth?: number;
  nodeHeight?: number;
  spacing?: number;
  rootNodeWidth?: number;
  rootNodeHeight?: number;
}

function treeToD3Hierarchy(
  treeData: WorldviewTreeNode[],
): { root: HierarchyNode<WorldviewTreeNode>; edges: Edge[] } {
  const edges: Edge[] = [];
  
  let rootNode: WorldviewTreeNode;
  if (treeData.length === 1) {
    rootNode = treeData[0];
  } else {
    rootNode = {
      id: '__virtual_root__',
      title: '',
      nodeType: 'group',
      children: treeData,
      payload: {},
      workId: '',
      parentId: null,
      sortIndex: 0,
      createdAt: '',
      updatedAt: '',
      depth: 0,
    } as WorldviewTreeNode;
  }

  const root = hierarchy(rootNode, (d: WorldviewTreeNode) => d.children);

  root.each((node: HierarchyNode<WorldviewTreeNode>) => {
    if (node.children) {
      for (const child of node.children) {
        edges.push({
          id: `${node.data.id}-${child.data.id}`,
          source: node.data.id,
          target: child.data.id,
          type: 'default',
          style: { strokeWidth: 1.5, stroke: '#94a3b8' },
        });
      }
    }
  });

  return { root, edges };
}

function d3LayoutToReactFlow(
  root: HierarchyPointNode<WorldviewTreeNode>,
  edges: Edge[],
  treeData: WorldviewTreeNode[],
  options: Required<TreeLayoutOptions>
): { nodes: LayoutedNode[]; edges: Edge[] } {
  const nodes: LayoutedNode[] = [];
  const { direction, nodeWidth, nodeHeight, rootNodeWidth, rootNodeHeight } = options;

  root.each((node) => {
    const data = node.data as WorldviewTreeNode;
    const isRoot = data.parentId === null && treeData.length === 1;
    const isVirtualRoot = data.id === '__virtual_root__';
    
    if (isVirtualRoot) return;

    let x: number, y: number;
    if (direction === 'DOWN') {
      x = node.x;
      y = node.y;
    } else {
      x = node.y;
      y = node.x;
    }

    const width = isRoot ? rootNodeWidth : nodeWidth;
    const height = isRoot ? rootNodeHeight : nodeHeight;

    nodes.push({
      id: data.id,
      type: 'custom',
      position: { x, y },
      width,
      height,
      data: {
        title: data.title,
        type: data.nodeType,
        hasChildren: data.children.length > 0,
        isRoot,
        note: data.payload.note,
        value: data.payload.value,
      },
      draggable: false,
      selectable: true,
    });
  });

  const filteredEdges = edges.filter(
    (e) => e.source !== '__virtual_root__' && e.target !== '__virtual_root__'
  );

  return { nodes, edges: filteredEdges };
}

export async function computeWorldviewLayout(
  treeData: WorldviewTreeNode[],
  options: TreeLayoutOptions = {}
): Promise<{ nodes: LayoutedNode[]; edges: Edge[] }> {
  const {
    direction = 'DOWN',
    nodeWidth = 160,
    nodeHeight = 60,
    spacing = 40,
    rootNodeWidth = 200,
    rootNodeHeight = 80,
  } = options;

  if (treeData.length === 0) {
    return { nodes: [], edges: [] };
  }

  const { root, edges } = treeToD3Hierarchy(treeData);

  const treeLayout = tree<WorldviewTreeNode>();
  treeLayout.nodeSize(
    direction === 'DOWN'
      ? [nodeWidth + spacing, nodeHeight + spacing * 1.5]
      : [nodeHeight + spacing * 1.5, nodeWidth + spacing]
  );
  
  const layoutedRoot = treeLayout(root);

  const { nodes, edges: flowEdges } = d3LayoutToReactFlow(
    layoutedRoot,
    edges,
    treeData,
    {
      direction,
      nodeWidth,
      nodeHeight,
      spacing,
      rootNodeWidth,
      rootNodeHeight,
    }
  );

  if (nodes.length > 0) {
    const minX = Math.min(...nodes.map((n) => n.position.x));
    const minY = Math.min(...nodes.map((n) => n.position.y));

    for (const node of nodes) {
      node.position.x -= minX;
      node.position.y -= minY;
    }
  }

  return { nodes, edges: flowEdges };
}

export function getLayoutBounds(nodes: LayoutedNode[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const maxX = Math.max(...nodes.map((n) => n.position.x + (n.width ?? 200)));
  const maxY = Math.max(...nodes.map((n) => n.position.y + (n.height ?? 80)));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
