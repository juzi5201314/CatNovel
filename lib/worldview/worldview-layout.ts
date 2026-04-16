import type { Node, Edge } from '@xyflow/react';
import type { WorldviewTreeNode } from './worldview-tree';

export interface LayoutedNode extends Node {
  position: { x: number; y: number };
}

export function computeWorldviewLayout(
  tree: WorldviewTreeNode[],
  options: {
    direction?: 'DOWN' | 'RIGHT';
    nodeWidth?: number;
    nodeHeight?: number;
    spacing?: number;
  } = {}
): { nodes: LayoutedNode[]; edges: Edge[] } {
  const {
    direction = 'DOWN',
    nodeWidth = 200,
    nodeHeight = 80,
    spacing = 50,
  } = options;

  // Simple hierarchical layout without ELK for now
  // Can be replaced with ELK for more sophisticated layouts
  const nodes: LayoutedNode[] = [];
  const edges: Edge[] = [];

  function layoutSubtree(
    subtree: WorldviewTreeNode[],
    startX: number,
    startY: number,
    depth: number
  ): number {
    if (subtree.length === 0) return startX;

    const levelOffset = direction === 'DOWN' ? nodeHeight + spacing : nodeWidth + spacing;
    const crossOffset = direction === 'DOWN' ? nodeWidth + spacing : nodeHeight + spacing;

    let currentX = startX;
    const childY = startY + levelOffset;

    for (const node of subtree) {
      // Position this node
      const position =
        direction === 'DOWN'
          ? { x: currentX, y: startY }
          : { x: startX, y: currentX };

      nodes.push({
        id: node.id,
        type: node.nodeType,
        position,
        data: {
          title: node.title,
          payload: node.payload,
          hasChildren: node.children.length > 0,
        },
        width: nodeWidth,
        height: nodeHeight,
      });

      // Create edges to children
      for (const child of node.children) {
        edges.push({
          id: `${node.id}-${child.id}`,
          source: node.id,
          target: child.id,
          type: 'smoothstep',
        });
      }

      // Layout children
      if (node.children.length > 0) {
        const childrenWidth = layoutSubtree(
          node.children,
          currentX,
          childY,
          depth + 1
        );
        currentX = Math.max(currentX + crossOffset, childrenWidth);
      } else {
        currentX += crossOffset;
      }
    }

    return currentX;
  }

  layoutSubtree(tree, 0, 0, 0);

  // Center the layout
  if (nodes.length > 0) {
    const minX = Math.min(...nodes.map((n) => n.position.x));
    const minY = Math.min(...nodes.map((n) => n.position.y));

    for (const node of nodes) {
      node.position.x -= minX;
      node.position.y -= minY;
    }
  }

  return { nodes, edges };
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
