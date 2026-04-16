'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type {
  SettingNodeRecord,
  WorldviewNodeType,
} from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { cx } from '@/lib/design/cx';
import {
  buildWorldviewTree,
  findNodeInTree,
  buildWorldviewOutline,
  type WorldviewTreeNode,
} from '@/lib/worldview/worldview-tree';
import {
  serializeWorldviewPayload,
  createWorldviewPayload,
  type WorldviewPayload,
} from '@/lib/worldview/worldview-payload';

interface WorldviewDialogProps {
  copy: AppMessages;
  workId: string;
  nodes: SettingNodeRecord[];
  onClose: () => void;
  onMutate: (action: string, payload: Record<string, unknown>) => Promise<void>;
}

interface LayoutedNode extends Node {
  position: { x: number; y: number };
}

type NodeData = Record<string, unknown> & {
  title: string;
  type: WorldviewNodeType;
  hasChildren: boolean;
  isRoot: boolean;
  note?: string;
  value?: string;
};

function computeSubtreeLayout(
  subtree: WorldviewTreeNode[],
  options: {
    direction?: 'DOWN' | 'RIGHT';
    nodeWidth?: number;
    nodeHeight?: number;
    spacing?: number;
  } = {}
): { nodes: LayoutedNode[]; edges: Edge[] } {
  const {
    direction = 'DOWN',
    nodeWidth = 160,
    nodeHeight = 60,
    rootNodeWidth = 200,
    rootNodeHeight = 80,
    spacing = 40,
  } = options as { direction: 'DOWN' | 'RIGHT'; nodeWidth: number; nodeHeight: number; rootNodeWidth: number; rootNodeHeight: number; spacing: number };

  const nodes: LayoutedNode[] = [];
  const edges: Edge[] = [];
  let isFirstNode = true;

  function layoutSubtree(
    nodesToLayout: WorldviewTreeNode[],
    startX: number,
    startY: number
  ): number {
    if (nodesToLayout.length === 0) return startX;

    const levelOffset = direction === 'DOWN' ? nodeHeight + spacing : nodeWidth + spacing;
    const crossOffset = direction === 'DOWN' ? nodeWidth + spacing : nodeHeight + spacing;

    let currentX = startX;

    for (const node of nodesToLayout) {
      const isRoot = isFirstNode;
      isFirstNode = false;

      const position =
        direction === 'DOWN'
          ? { x: currentX, y: startY }
          : { x: startX, y: currentX };

      const width = isRoot ? rootNodeWidth : nodeWidth;
      const height = isRoot ? rootNodeHeight : nodeHeight;

      nodes.push({
        id: node.id,
        type: 'custom',
        position,
        data: {
          title: node.title,
          type: node.nodeType,
          hasChildren: node.children.length > 0,
          isRoot,
          note: node.payload.note,
          value: node.payload.value,
        } as NodeData,
        width,
        height,
        draggable: false,
        selectable: true,
      });

      for (const child of node.children) {
        edges.push({
          id: `${node.id}-${child.id}`,
          source: node.id,
          target: child.id,
          type: 'smoothstep',
        });
      }

      if (node.children.length > 0) {
        const childrenWidth = layoutSubtree(
          node.children,
          currentX,
          startY + levelOffset
        );
        currentX = Math.max(currentX + crossOffset, childrenWidth);
      } else {
        currentX += crossOffset;
      }
    }

    return currentX;
  }

  layoutSubtree(subtree, 0, 0);

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

function CustomNode({ data }: { data: NodeData }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const typeLabel = data.type === 'group' ? '组' : data.type === 'entry' ? '条' : '引';
  const typeColor = data.type === 'group'
    ? 'bg-blue-100 border-blue-300 text-blue-800'
    : data.type === 'entry'
      ? 'bg-green-100 border-green-300 text-green-800'
      : 'bg-purple-100 border-purple-300 text-purple-800';

  const rootStyles = data.isRoot
    ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-400 shadow-md'
    : 'bg-white border-gray-200 shadow-sm';

  const tooltipContent = data.value
    ? data.value.substring(0, 200) + (data.value.length > 200 ? '...' : '')
    : data.note
      ? data.note.substring(0, 200) + (data.note.length > 200 ? '...' : '')
      : null;

  return (
    <div
      className={cx(
        'relative rounded-lg border p-2 flex flex-col items-center justify-center transition-all duration-200',
        'hover:shadow-lg hover:border-primary/50 cursor-pointer',
        rootStyles,
        data.isRoot ? 'min-w-[180px] min-h-[70px]' : 'min-w-[140px] min-h-[50px]'
      )}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      <div className="flex items-center gap-2 w-full">
        <span className={cx(
          'text-xs font-medium px-1.5 py-0.5 rounded border',
          typeColor
        )}>
          {typeLabel}
        </span>
        <span className={cx(
          'font-medium truncate flex-1 text-center',
          data.isRoot ? 'text-base' : 'text-sm',
          data.isRoot ? 'text-amber-900' : 'text-gray-800'
        )}>
          {data.title}
        </span>
      </div>

      {data.hasChildren && (
        <span className="text-xs text-gray-500 mt-1">
          {data.isRoot ? '点击展开子节点' : '有子节点'}
        </span>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />

      {showTooltip && tooltipContent && (
        <div className={cx(
          'absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2',
          'w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl',
          'pointer-events-none'
        )}>
          <div className="font-semibold mb-1 text-gray-300">{data.title}</div>
          <div className="line-clamp-6 whitespace-pre-wrap">{tooltipContent}</div>
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

interface SubtreeCanvasProps {
  rootNode: WorldviewTreeNode;
  onSelectNode: (nodeId: string) => void;
}

function SubtreeCanvas({ rootNode, onSelectNode }: SubtreeCanvasProps) {
  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => {
    return computeSubtreeLayout([rootNode], { direction: 'DOWN' });
  }, [rootNode]);

  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      onSelectNode(node.id);
    },
    [onSelectNode]
  );

  return (
    <div className="flex-1 relative h-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-left"
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        panOnScroll={false}
      >
        <Background gap={12} size={1} />
        <Controls />
      </ReactFlow>

      <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-sm">
        <span className="text-sm font-medium text-foreground">{rootNode.title}</span>
      </div>

      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
        点击节点进行编辑
      </div>
    </div>
  );
}

interface ChildNodeListProps {
  childNodes: WorldviewTreeNode[];
  onEditChild: (child: WorldviewTreeNode) => void;
  onDeleteChild: (childId: string) => void;
  onMoveChild: (childId: string, direction: 'up' | 'down') => void;
  onExpandChild: (childId: string) => void;
  expandedChildren: Set<string>;
  depth?: number;
}

function ChildNodeList({
  childNodes,
  onEditChild,
  onDeleteChild,
  onMoveChild,
  onExpandChild,
  expandedChildren,
  depth = 0,
}: ChildNodeListProps) {
  if (childNodes.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-xs py-4">
        暂无子节点
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {childNodes.map((child, index) => {
        const isExpanded = expandedChildren.has(child.id);
        const canExpand = child.children.length > 0;
        const canMoveUp = index > 0;
        const canMoveDown = index < childNodes.length - 1;

        return (
          <div key={child.id}>
            <div
              className={cx(
                'flex items-center gap-2 p-2 rounded-md border bg-background',
                'hover:border-primary/50 transition-colors'
              )}
              style={{ marginLeft: `${depth * 16}px` }}
            >
              {canExpand && (
                <button
                  onClick={() => onExpandChild(child.id)}
                  className="w-5 h-5 flex items-center justify-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
              )}
              {!canExpand && <span className="w-5" />}

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{child.title}</div>
                <div className="text-xs text-muted-foreground">
                  {child.nodeType === 'group' ? '分组' : child.nodeType === 'entry' ? '条目' : '引用'}
                  {child.children.length > 0 && ` · ${child.children.length} 个子节点`}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {canMoveUp && (
                  <button
                    onClick={() => onMoveChild(child.id, 'up')}
                    className="w-6 h-6 flex items-center justify-center text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                    title="上移"
                  >
                    ↑
                  </button>
                )}
                {canMoveDown && (
                  <button
                    onClick={() => onMoveChild(child.id, 'down')}
                    className="w-6 h-6 flex items-center justify-center text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                    title="下移"
                  >
                    ↓
                  </button>
                )}
                <button
                  onClick={() => onEditChild(child)}
                  className="w-6 h-6 flex items-center justify-center text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                  title="编辑"
                >
                  ✎
                </button>
                <button
                  onClick={() => onDeleteChild(child.id)}
                  className="w-6 h-6 flex items-center justify-center text-xs text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="删除"
                >
                  ×
                </button>
              </div>
            </div>

            {canExpand && isExpanded && (
              <ChildNodeList
                childNodes={child.children}
                onEditChild={onEditChild}
                onDeleteChild={onDeleteChild}
                onMoveChild={onMoveChild}
                onExpandChild={onExpandChild}
                expandedChildren={expandedChildren}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface NodeEditorProps {
  node: WorldviewTreeNode;
  nodes: SettingNodeRecord[];
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: { title?: string; payload?: WorldviewPayload }) => Promise<void>;
  onDeleteNode: (nodeId: string) => Promise<void>;
  onCreateChild: (type: WorldviewNodeType, parentId: string) => Promise<void>;
  onMoveNode: (nodeId: string, newParentId: string | null) => Promise<void>;
  onConvertNode: (nodeId: string, newType: WorldviewNodeType) => Promise<void>;
  onReorderChildren: (parentId: string, childId: string, direction: 'up' | 'down') => Promise<void>;
}

function NodeEditor({
  node,
  nodes,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onCreateChild,
  onMoveNode,
  onConvertNode,
  onReorderChildren,
}: NodeEditorProps) {
  const [expandedChildren, setExpandedChildren] = useState<Set<string>>(new Set());

  const toggleExpandChild = useCallback((childId: string) => {
    setExpandedChildren((prev) => {
      const next = new Set(prev);
      if (next.has(childId)) {
        next.delete(childId);
      } else {
        next.add(childId);
      }
      return next;
    });
  }, []);

  const handleMoveChild = useCallback(
    async (childId: string, direction: 'up' | 'down') => {
      await onReorderChildren(node.id, childId, direction);
    },
    [node.id, onReorderChildren]
  );

  const handleDeleteChild = useCallback(
    async (childId: string) => {
      if (confirm('确定要删除此节点吗？此操作不可撤销。')) {
        await onDeleteNode(childId);
      }
    },
    [onDeleteNode]
  );

  const handleEditChild = useCallback((_child: WorldviewTreeNode) => {}, []);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-4 p-4 border-b">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 8h8M4 8l3-3M4 8l3 3" />
          </svg>
          返回画布
        </button>
        <h2 className="text-lg font-semibold">编辑节点</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">基本信息</h3>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">标题</label>
            <input
              type="text"
              value={node.title}
              onChange={(e) => onUpdateNode(node.id, { title: e.target.value })}
              className="w-full h-9 px-3 text-sm rounded-md bg-background border shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">类型</label>
            <select
              value={node.nodeType}
              onChange={(e) => onConvertNode(node.id, e.target.value as WorldviewNodeType)}
              disabled={node.children.length > 0}
              className="w-full h-9 px-3 text-sm rounded-md bg-background border shadow-sm disabled:opacity-50"
            >
              <option value="group">分组</option>
              <option value="entry">条目</option>
              <option value="reference">引用</option>
            </select>
            {node.children.length > 0 && (
              <p className="text-xs text-amber-600">
                有子节点时不能改为非分组类型
              </p>
            )}
          </div>
        </div>

        {node.nodeType === 'group' && (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">描述</label>
            <textarea
              value={node.payload.note || ''}
              onChange={(e) =>
                onUpdateNode(node.id, {
                  payload: {
                    ...node.payload,
                    note: e.target.value,
                  },
                })
              }
              className="w-full h-24 px-3 py-2 text-sm rounded-md bg-background border shadow-sm resize-none"
              placeholder="输入分组描述..."
            />
          </div>
        )}

        {node.nodeType === 'entry' && (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">内容</label>
            <textarea
              value={node.payload.value || ''}
              onChange={(e) =>
                onUpdateNode(node.id, {
                  payload: {
                    ...node.payload,
                    value: e.target.value,
                  },
                })
              }
              className="w-full h-48 px-3 py-2 text-sm rounded-md bg-background border shadow-sm resize-none"
              placeholder="输入条目内容..."
            />
          </div>
        )}

        {node.nodeType === 'reference' && (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">引用目标</label>
            <select
              value={node.payload.refTarget || ''}
              onChange={(e) =>
                onUpdateNode(node.id, {
                  payload: {
                    ...node.payload,
                    refTarget: e.target.value,
                  },
                })
              }
              className="w-full h-9 px-3 text-sm rounded-md bg-background border shadow-sm"
            >
              <option value="">选择目标...</option>
              {nodes
                .filter((n) => n.id !== node.id)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">父节点</label>
          <select
            value={node.parentId || ''}
            onChange={(e) => onMoveNode(node.id, e.target.value || null)}
            className="w-full h-9 px-3 text-sm rounded-md bg-background border shadow-sm"
          >
            <option value="">（根节点）</option>
            {nodes
              .filter(
                (n) =>
                  n.id !== node.id &&
                  (n.nodeType === 'group' ||
                    n.nodeType === 'character' ||
                    n.nodeType === 'location' ||
                    n.nodeType === 'item' ||
                    n.nodeType === 'world' ||
                    n.nodeType === 'plot' ||
                    n.nodeType === 'rule')
              )
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
          </select>
        </div>

        {node.nodeType === 'group' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">子节点列表</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => onCreateChild('group', node.id)}
                  className="px-3 h-7 text-xs bg-background border rounded-md hover:bg-muted transition-colors"
                >
                  + 分组
                </button>
                <button
                  onClick={() => onCreateChild('entry', node.id)}
                  className="px-3 h-7 text-xs bg-background border rounded-md hover:bg-muted transition-colors"
                >
                  + 条目
                </button>
                <button
                  onClick={() => onCreateChild('reference', node.id)}
                  className="px-3 h-7 text-xs bg-background border rounded-md hover:bg-muted transition-colors"
                >
                  + 引用
                </button>
              </div>
            </div>

            <ChildNodeList
              childNodes={node.children}
              onEditChild={handleEditChild}
              onDeleteChild={handleDeleteChild}
              onMoveChild={handleMoveChild}
              onExpandChild={toggleExpandChild}
              expandedChildren={expandedChildren}
            />
          </div>
        )}

        <div className="pt-4 border-t">
          <button
            onClick={() => {
              if (confirm('确定要删除此节点吗？此操作不可撤销。')) {
                onDeleteNode(node.id);
                onClose();
              }
            }}
            className="w-full h-9 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors border border-red-200"
          >
            删除节点
          </button>
          {node.children.length > 0 && (
            <p className="text-xs text-amber-600 mt-2">
              此节点有 {node.children.length} 个子节点，删除后将同时删除所有子节点
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function WorldviewDialog({
  copy: _copy,
  workId,
  nodes,
  onClose,
  onMutate,
}: WorldviewDialogProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildWorldviewTree(nodes), [nodes]);
  const outline = useMemo(
    () => buildWorldviewOutline(tree, expandedIds),
    [tree, expandedIds]
  );

  const selectedNode = useMemo(
    () => (selectedNodeId ? findNodeInTree(tree, selectedNodeId) : null),
    [tree, selectedNodeId]
  );

  const effectiveActiveRootId = activeRootId ?? (tree[0]?.id ?? null);

  const activeRootNode = useMemo(
    () => (effectiveActiveRootId ? findNodeInTree(tree, effectiveActiveRootId) : tree[0] || null),
    [tree, effectiveActiveRootId]
  );

  const handleCreateNode = useCallback(
    async (type: WorldviewNodeType, parentId: string | null) => {
      const title = type === 'group' ? '新分组' : type === 'entry' ? '新条目' : '新引用';
      await onMutate('create-worldview-node', {
        workId,
        nodeType: type,
        title,
        parentId,
        payloadJson: serializeWorldviewPayload(createWorldviewPayload(type)),
      });
    },
    [onMutate, workId]
  );

  const handleUpdateNode = useCallback(
    async (nodeId: string, updates: { title?: string; payload?: WorldviewPayload }) => {
      await onMutate('update-setting-node', {
        nodeId,
        title: updates.title,
        payloadJson: updates.payload
          ? serializeWorldviewPayload(updates.payload)
          : undefined,
      });
    },
    [onMutate]
  );

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      await onMutate('delete-setting-node', { nodeId });
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [onMutate, selectedNodeId]
  );

  const handleMoveNode = useCallback(
    async (nodeId: string, newParentId: string | null) => {
      await onMutate('move-worldview-node', {
        nodeId,
        parentId: newParentId,
      });
    },
    [onMutate]
  );

  const handleConvertNode = useCallback(
    async (nodeId: string, newType: WorldviewNodeType) => {
      await onMutate('convert-worldview-node', {
        nodeId,
        nodeType: newType,
        payloadJson: serializeWorldviewPayload(createWorldviewPayload(newType)),
      });
    },
    [onMutate]
  );

  const handleReorderChildren = useCallback(
    async (parentId: string, childId: string, direction: 'up' | 'down') => {
      await onMutate('reorder-worldview-children', {
        parentId,
        childId,
        direction,
      });
    },
    [onMutate]
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedNodeId) {
          setSelectedNodeId(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, selectedNodeId]);

  const filteredOutline = useMemo(() => {
    if (!searchQuery.trim()) return outline;
    const lowerQuery = searchQuery.toLowerCase();
    return outline.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerQuery) ||
        findNodeInTree(tree, item.id)?.payload.note?.
          toLowerCase()
          .includes(lowerQuery)
    );
  }, [outline, searchQuery, tree]);

  return (
    <div className="settings-overlay">
      <div className="settings-layout">
        <div className="border-r flex flex-col overflow-hidden bg-muted/20">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">世界观</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索节点..."
              className="w-full h-9 px-3 text-sm rounded-md bg-background border shadow-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredOutline.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                无匹配节点
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredOutline.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedNodeId(item.id);
                      if (item.depth === 0) {
                        setActiveRootId(item.id);
                      }
                    }}
                    className={cx(
                      'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                      selectedNodeId === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                    style={{ paddingLeft: `${item.depth * 16 + 12}px` }}
                  >
                    <div className="flex items-center gap-2">
                      {item.hasChildren && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(item.id);
                          }}
                          className="text-xs cursor-pointer"
                        >
                          {item.expanded ? '▼' : '▶'}
                        </span>
                      )}
                      <span className="truncate">{item.title}</span>
                      <span className="text-xs opacity-60 ml-auto">
                        {item.type === 'group' ? '组' : item.type === 'entry' ? '条' : '引'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 border-t flex gap-2">
            <button
              onClick={() => handleCreateNode('group', null)}
              className="flex-1 h-8 text-xs bg-background border rounded-md hover:bg-muted transition-colors"
            >
              + 分组
            </button>
            <button
              onClick={() => handleCreateNode('entry', null)}
              className="flex-1 h-8 text-xs bg-background border rounded-md hover:bg-muted transition-colors"
            >
              + 条目
            </button>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden relative">
          {selectedNode ? (
            <NodeEditor
              node={selectedNode}
              nodes={nodes}
              onClose={() => setSelectedNodeId(null)}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
              onCreateChild={handleCreateNode}
              onMoveNode={handleMoveNode}
              onConvertNode={handleConvertNode}
              onReorderChildren={handleReorderChildren}
            />
          ) : (
            <>
              {tree.length > 1 && (
                <div className="border-b p-2 bg-muted/20">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">画布:</span>
                    {tree.map((root) => (
                      <button
                        key={root.id}
                        onClick={() => setActiveRootId(root.id)}
                        className={cx(
                          'px-3 py-1 text-xs rounded-md whitespace-nowrap transition-colors',
                          effectiveActiveRootId === root.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background border hover:bg-muted'
                        )}
                      >
                        {root.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeRootNode ? (
                <SubtreeCanvas
                  rootNode={activeRootNode}
                  onSelectNode={setSelectedNodeId}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">暂无节点</p>
                    <button
                      onClick={() => handleCreateNode('group', null)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      创建第一个分组
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
