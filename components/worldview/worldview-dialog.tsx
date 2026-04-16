'use client';

import { useCallback, useEffect, useMemo, useRef, useState, createContext, useContext } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type ReactFlowInstance,
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
  getNodePath,
  type WorldviewTreeNode,
} from '@/lib/worldview/worldview-tree';
import {
  serializeWorldviewPayload,
  createWorldviewPayload,
  type WorldviewPayload,
} from '@/lib/worldview/worldview-payload';
import {
  computeWorldviewLayout,
  type LayoutedNode,
} from '@/lib/worldview/worldview-layout';

// 布局方向 Context
const LayoutDirectionContext = createContext<'DOWN' | 'RIGHT'>('DOWN');

// ============================================
// 类型定义
// ============================================
interface WorldviewDialogProps {
  copy: AppMessages;
  workId: string;
  nodes: SettingNodeRecord[];
  onClose: () => void;
  onMutate: (action: string, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
}


type NodeData = {
  title: string;
  type: WorldviewNodeType;
  hasChildren: boolean;
  isRoot: boolean;
  note?: string;
  value?: string;
};

interface NodeContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string | null;
  nodeData: NodeData | null;
}

// ============================================
// 节点右键菜单组件
// ============================================

interface NodeContextMenuProps {
  state: NodeContextMenuState;
  onClose: () => void;
  onCreateChild: (type: WorldviewNodeType, parentId: string) => Promise<void>;
  onDeleteNode: (nodeId: string) => Promise<void>;
  onMoveNode: (nodeId: string, newParentId: string | null) => Promise<void>;
  nodes: SettingNodeRecord[];
}

function NodeContextMenu({
  state,
  onClose,
  onCreateChild,
  onDeleteNode,
  onMoveNode,
  nodes,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const moveDialogRef = useRef<HTMLDivElement>(null);
  const [showSubmenu, setShowSubmenu] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  const handleCloseMenu = useCallback(() => {
    setShowMoveDialog(false);
    onClose();
  }, [onClose]);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!state.visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as globalThis.Node;
      const isInsideMenu = menuRef.current?.contains(target);
      const isInsideMoveDialog = moveDialogRef.current?.contains(target);
      if (!isInsideMenu && !isInsideMoveDialog) {
        handleCloseMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [state.visible, handleCloseMenu]);

  // 菜单项点击时阻止事件冒泡
  const handleItemClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // 处理添加子节点
  const handleCreateChild = useCallback(
    async (type: WorldviewNodeType) => {
      if (!state.nodeId) return;
      await onCreateChild(type, state.nodeId);
      handleCloseMenu();
    },
    [state.nodeId, onCreateChild, handleCloseMenu]
  );

  // 处理删除节点
  const handleDelete = useCallback(async () => {
    if (!state.nodeId) return;
    if (confirm('确定要删除此节点吗？此操作不可撤销。')) {
      await onDeleteNode(state.nodeId);
      handleCloseMenu();
    }
  }, [state.nodeId, onDeleteNode, handleCloseMenu]);

  // 处理移动节点
  const handleMoveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMoveDialog(true);
  }, []);

  if (!state.visible || !state.nodeId) return null;

  return (
    <>
      {/* 右键菜单 */}
      <div
        ref={menuRef}
        className={cx(
          'fixed z-[100] min-w-[180px] bg-background border rounded-lg shadow-xl',
          'py-1 animate-in fade-in zoom-in-95 duration-150'
        )}
        style={{
          left: state.x,
          top: state.y,
        }}
      >
        {state.nodeData?.type === 'group' && (
          <>
            <div
              className="relative group"
              onMouseEnter={() => setShowSubmenu(true)}
              onMouseLeave={() => setShowSubmenu(false)}
            >
              <button
                onClick={handleItemClick}
                className={cx(
                  'w-full px-3 py-2 text-sm text-left flex items-center justify-between',
                  'hover:bg-muted transition-colors'
                )}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  添加子节点
                </span>
                <svg className="w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {showSubmenu && (
                <div
                  className={cx(
                    'absolute left-full top-0 -ml-1 min-w-[140px] pl-2',
                    'bg-transparent'
                  )}
                >
                  <div
                    className={cx(
                      'bg-background border rounded-lg shadow-xl py-1',
                      'animate-in fade-in slide-in-from-left-2 duration-150'
                    )}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateChild('group');
                      }}
                      className={cx(
                        'w-full px-3 py-2 text-sm text-left flex items-center gap-2',
                        'hover:bg-gray-50 hover:text-gray-900 transition-colors'
                      )}>
                      <span className="w-2 h-2 rounded-full bg-gray-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateChild('entry');
                      }}
                      className={cx(
                        'w-full px-3 py-2 text-sm text-left flex items-center gap-2',
                        'hover:bg-green-50 hover:text-green-700 transition-colors'
                      )}
                    >
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      添加条目
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-border my-1" />
          </>
        )}

        {/* 移动到其他节点 */}
        <button
          onClick={handleMoveClick}
          className={cx(
            'w-full px-3 py-2 text-sm text-left flex items-center gap-2',
            'hover:bg-muted transition-colors'
          )}
        >
          <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          移动到其他节点
        </button>

        {/* 分隔线 */}
        <div className="h-px bg-border my-1" />

        {/* 删除节点 - 红色突出显示 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className={cx(
            'w-full px-3 py-2 text-sm text-left flex items-center gap-2',
            'text-red-600 hover:bg-red-50 transition-colors'
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          删除节点
        </button>
      </div>

      {showMoveDialog && state.nodeId && (
        <div ref={moveDialogRef} className="contents">
          <MoveNodeDialog
            nodeId={state.nodeId}
            nodes={nodes}
            onMove={onMoveNode}
            onClose={() => setShowMoveDialog(false)}
          />
        </div>
      )}
    </>
  );
}

// ============================================
// 移动节点对话框组件
// ============================================

interface ParentSelectorDialogProps {
  nodeId: string;
  nodes: SettingNodeRecord[];
  currentParentId?: string | null;
  onSelect: (parentId: string | null) => void;
  onClose: () => void;
  title?: string;
}

function ParentSelectorDialog({ 
  nodeId, 
  nodes, 
  currentParentId,
  onSelect, 
  onClose,
  title = '选择父节点'
}: ParentSelectorDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const eligibleParents = useMemo(() => {
    return nodes.filter(
      (n) =>
        n.id !== nodeId &&
        n.nodeType === 'group'
    );
  }, [nodes, nodeId]);

  const filteredParents = useMemo(() => {
    if (!searchQuery.trim()) return eligibleParents;
    const query = searchQuery.toLowerCase();
    return eligibleParents.filter((n) =>
      n.title.toLowerCase().includes(query)
    );
  }, [eligibleParents, searchQuery]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSelect = (parentId: string | null) => {
    onSelect(parentId);
    onClose();
  };

    return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background rounded-xl shadow-2xl border border-border w-[420px] max-h-[70vh] flex flex-col animate-fade-in relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="关闭 (Esc)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        <div className="flex items-center px-5 py-4 border-b">
          <h3 className="font-semibold pr-8">{title}</h3>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索节点..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {filteredParents.length} / {eligibleParents.length} 个节点
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => handleSelect(null)}
            className={cx(
              'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
              !currentParentId
                ? 'bg-gray-100 text-gray-900 font-medium ring-1 ring-gray-300'
                : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
            )}
          >
            <div className="flex items-center gap-2">
              {!currentParentId && (
                <svg className="w-4 h-4 text-gray-900 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>（根节点）</span>
            </div>
          </button>
          {filteredParents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm">无匹配节点</p>
            </div>
          ) : (
            <div className="space-y-1 mt-1">
              {filteredParents.map((parent) => {
                const isSelected = currentParentId === parent.id;
                return (
                  <button
                    key={parent.id}
                    onClick={() => handleSelect(parent.id)}
                    className={cx(
                      'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                      isSelected
                        ? 'bg-gray-100 text-gray-900 font-medium ring-1 ring-gray-300'
                        : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <svg className="w-4 h-4 text-gray-900 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      <span className="flex-1 truncate">{parent.title}</span>
                      <span className="text-xs text-muted-foreground/60 shrink-0">
                        {parent.nodeType === 'group' ? '分组' : '条目'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
interface MoveNodeDialogProps {
  nodeId: string;
  nodes: SettingNodeRecord[];
  onMove: (nodeId: string, newParentId: string | null) => Promise<void>;
  onClose: () => void;
}

function MoveNodeDialog({ nodeId, nodes, onMove, onClose }: MoveNodeDialogProps) {
  const currentNode = useMemo(() => {
    return nodes.find((n) => n.id === nodeId);
  }, [nodes, nodeId]);

  const handleSelect = async (parentId: string | null) => {
    try {
      await onMove(nodeId, parentId);
    } catch (error) {
      console.error('Move node failed:', error);
      alert(error instanceof Error ? error.message : '移动节点失败');
      throw error;
    }
  };

  return (
    <ParentSelectorDialog
      nodeId={nodeId}
      nodes={nodes}
      currentParentId={currentNode?.parentId}
      onSelect={handleSelect}
      onClose={onClose}
      title="选择新父节点"
    />
  );
}

// ============================================
// 自定义节点组件（带右键菜单支持）
interface CustomNodeProps {
  data: NodeData;
  id: string;
}

function CustomNode({ data }: CustomNodeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  // 从父组件 SubtreeCanvas 通过 React Context 获取布局方向
  const direction = useContext(LayoutDirectionContext);
  
  // 根据布局方向确定 Handle 位置
  const targetPosition = direction === 'DOWN' ? Position.Top : Position.Left;
  const sourcePosition = direction === 'DOWN' ? Position.Bottom : Position.Right;
  const typeLabel = data.type === 'group' ? '组' : '条';
  const typeColor = data.type === 'group'
    ? 'bg-gray-100 border-gray-300 text-gray-700'
    : 'bg-green-100 border-green-300 text-green-800';

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
        'hover:shadow-lg hover:border-gray-400 cursor-pointer',
        rootStyles,
        data.isRoot ? 'min-w-[180px] min-h-[70px]' : 'min-w-[140px] min-h-[50px]'
      )}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Handle type="target" position={targetPosition} className="!bg-gray-400" />

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

      <Handle type="source" position={sourcePosition} className="!bg-gray-400" />

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

// ============================================
// ============================================
// 子树画布组件
// ============================================

interface SubtreeCanvasProps {
  rootNode: WorldviewTreeNode;
  onSelectNode: (nodeId: string) => void;
  focusNodeId?: string | null;
  onContextMenu?: (event: React.MouseEvent, node: Node) => void;
}

function SubtreeCanvas({ rootNode, onSelectNode, focusNodeId, onContextMenu }: SubtreeCanvasProps) {
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [flowNodes, setFlowNodes] = useState<LayoutedNode[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [isLayouting, setIsLayouting] = useState(true);
  const [layoutDirection, setLayoutDirection] = useState<'DOWN' | 'RIGHT'>('DOWN');

  // 异步计算布局
  useEffect(() => {
    let cancelled = false;
    
    async function computeLayout() {
      setIsLayouting(true);
      try {
        const { nodes, edges } = await computeWorldviewLayout([rootNode], { 
          direction: layoutDirection,
          nodeWidth: 160,
          nodeHeight: 60,
          spacing: 40,
          rootNodeWidth: 200,
          rootNodeHeight: 80,
        });
        if (!cancelled) {
          setFlowNodes(nodes);
          setFlowEdges(edges);
        }
      } finally {
        if (!cancelled) {
          setIsLayouting(false);
        }
      }
    }
    
    computeLayout();
    
    return () => {
      cancelled = true;
    };
  }, [rootNode, layoutDirection]);

  // 聚焦节点或布局完成后适应视图
  useEffect(() => {
    if (!reactFlowInstance.current || flowNodes.length === 0) return;
    
    setTimeout(() => {
      if (focusNodeId) {
        const nodeExists = flowNodes.some(n => n.id === focusNodeId);
        if (nodeExists) {
          reactFlowInstance.current?.fitView({
            nodes: [{ id: focusNodeId }],
            padding: 0.3,
            duration: 500,
          });
          return;
        }
      }
      // 没有聚焦节点时适应整个视图
      reactFlowInstance.current?.fitView({
        padding: 0.2,
        duration: 500,
      });
    }, 100);
  }, [focusNodeId, flowNodes, layoutDirection]);
  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      onSelectNode(node.id);
    },
    [onSelectNode]
  );

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  // 防止画布上的右键菜单（除了节点上）
  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
  }, []);

  return (
    <LayoutDirectionContext.Provider value={layoutDirection}>
      <div className="flex-1 relative h-full">
        {isLayouting && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <div className="text-sm text-muted-foreground">布局计算中...</div>
          </div>
        )}
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodeClick={handleNodeClick}
          onNodeContextMenu={onContextMenu}
          onInit={handleInit}
          onPaneContextMenu={handlePaneContextMenu}
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

      {/* 布局方向切换按钮 */}
      <button
        onClick={() => setLayoutDirection(prev => prev === 'DOWN' ? 'RIGHT' : 'DOWN')}
        className={cx(
          'absolute top-4 right-4 w-9 h-9 flex items-center justify-center',
          'bg-background/90 backdrop-blur-sm border rounded-lg shadow-sm',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
          'transition-colors'
        )}
        title={layoutDirection === 'DOWN' ? '切换为横向布局' : '切换为纵向布局'}
      >
        {layoutDirection === 'DOWN' ? (
          // 纵向图标（树向下）
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v6" />
            <path d="M12 9l-4 4" />
            <path d="M12 9l4 4" />
            <path d="M8 13v6" />
            <path d="M16 13v6" />
          </svg>
        ) : (
          // 横向图标（树向右）
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h6" />
            <path d="M9 12l4-4" />
            <path d="M9 12l4 4" />
            <path d="M13 8h6" />
            <path d="M13 16h6" />
          </svg>
        )}
      </button>

      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
        点击节点进行编辑 · 右键节点打开菜单
      </div>
    </div>
  </LayoutDirectionContext.Provider>
  );
}
const nodeTypes = {
  custom: CustomNode,
};
// ============================================
// 子节点列表组件
// ============================================

interface ChildNodeListProps {
  childNodes: WorldviewTreeNode[];
  onEditChild: (child: WorldviewTreeNode) => void;
  onDeleteChild: (childId: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onExpandChild: (childId: string) => void;
  expandedChildren: Set<string>;
  depth?: number;
}

function ChildNodeList({
  childNodes,
  onEditChild,
  onDeleteChild,
  onReorder,
  onExpandChild,
  expandedChildren,
  depth = 0,
}: ChildNodeListProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    setDraggedId(nodeId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, nodeId: string) => {
    e.preventDefault();
    if (nodeId !== draggedId) {
      setDragOverId(nodeId);
    }
  }, [draggedId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverId(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);

    if (!draggedId || draggedId === targetId) {
      return;
    }

    const draggedIndex = childNodes.findIndex((n) => n.id === draggedId);
    const targetIndex = childNodes.findIndex((n) => n.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      return;
    }

    const newOrder = [...childNodes];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    onReorder(newOrder.map((n) => n.id));
  }, [draggedId, childNodes, onReorder]);

  if (childNodes.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-xs py-4">
        暂无子节点
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {childNodes.map((child) => {
        const isExpanded = expandedChildren.has(child.id);
        const canExpand = child.children.length > 0;
        const isDragging = draggedId === child.id;
        const isDragOver = dragOverId === child.id;

        return (
          <div key={child.id}>
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, child.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, child.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, child.id)}
              className={cx(
                'bg-background border rounded-md p-2 flex items-center gap-2',
                'hover:border-gray-400/50 transition-all duration-200',
                isDragging && 'opacity-50',
                isDragOver && 'border-gray-600 bg-gray-50'
              )}
              style={{ marginLeft: `${depth * 16}px`, cursor: 'move' }}
            >
              <div className="w-5 h-5 flex items-center justify-center text-xs text-muted-foreground/60 hover:text-muted-foreground cursor-grab active:cursor-grabbing">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <circle cx="3" cy="3" r="1" />
                  <circle cx="3" cy="6" r="1" />
                  <circle cx="3" cy="9" r="1" />
                  <circle cx="9" cy="3" r="1" />
                  <circle cx="9" cy="6" r="1" />
                  <circle cx="9" cy="9" r="1" />
                </svg>
              </div>
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
                  {child.nodeType === 'group' ? '分组' : '条目'}
                  {child.children.length > 0 && ` · ${child.children.length} 个子节点`}
                </div>
              </div>

              <div className="flex items-center gap-1">
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
                onReorder={onReorder}
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

// ============================================
// 父节点选择器组件
// ============================================

interface ParentSelectorProps {
  node: WorldviewTreeNode;
  nodes: SettingNodeRecord[];
  onMoveNode: (nodeId: string, newParentId: string | null) => Promise<void>;
}

function ParentSelector({ node, nodes, onMoveNode }: ParentSelectorProps) {
  const [open, setOpen] = useState(false);

  const currentParent = useMemo(() => {
    if (!node.parentId) return null;
    return nodes.find((n) => n.id === node.parentId);
  }, [nodes, node.parentId]);

  const handleSelect = async (parentId: string | null) => {
    await onMoveNode(node.id, parentId);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground">父节点</label>
      <button
        onClick={() => setOpen(true)}
        className={cx(
          'w-full h-9 px-3 text-sm rounded-md bg-background border shadow-sm',
          'flex items-center justify-between',
          'hover:border-gray-400 transition-colors text-left'
        )}
      >
        <span className={cx('truncate', !currentParent && 'text-muted-foreground')}>
        </span>
        <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ParentSelectorDialog
          nodeId={node.id}
          nodes={nodes}
          currentParentId={node.parentId}
          onSelect={handleSelect}
          onClose={() => setOpen(false)}
          title="选择父节点"
        />
      )}
    </div>
  );
}

// ============================================
// 节点编辑器组件
// ============================================

interface NodeEditorProps {
  node: WorldviewTreeNode;
  nodes: SettingNodeRecord[];
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: { title?: string; payload?: WorldviewPayload }) => Promise<void>;
  onDeleteNode: (nodeId: string) => Promise<void>;
  onCreateChild: (type: WorldviewNodeType, parentId: string) => Promise<void>;
  onMoveNode: (nodeId: string, newParentId: string | null) => Promise<void>;
  onConvertNode: (nodeId: string, newType: WorldviewNodeType) => Promise<void>;
  onReorderChildren: (parentId: string, orderedIds: string[]) => Promise<void>;
}

function NodeEditor({
  node,
  nodes,
  onClose,
  onSelectNode,
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

  const handleReorder = useCallback(
    async (orderedIds: string[]) => {
      await onReorderChildren(node.id, orderedIds);
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

  const handleEditChild = useCallback((child: WorldviewTreeNode) => {
    onSelectNode(child.id);
  }, [onSelectNode]);

  return (
    <div className="flex flex-col h-full bg-background relative">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="返回画布"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>

      <div className="flex items-center p-4 border-b">
        <h2 className="text-lg font-semibold pr-8">编辑节点</h2>
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

        <ParentSelector
          node={node}
          nodes={nodes}
          onMoveNode={onMoveNode}
        />

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
              </div>
            </div>

            <ChildNodeList
              childNodes={node.children}
              onEditChild={handleEditChild}
              onDeleteChild={handleDeleteChild}
              onReorder={handleReorder}
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

// ============================================
// 主对话框组件
// ============================================

export function WorldviewDialog({
  copy,
  workId,
  nodes,
  onClose,
  onMutate,
}: WorldviewDialogProps) {
  void copy;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<NodeContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    nodeId: null,
    nodeData: null,
  });

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
      const title = type === 'group' ? '新分组' : '新条目';
      const result = await onMutate('create-worldview-node', {
        workId,
        nodeType: type,
        title,
        parentId,
        payloadJson: serializeWorldviewPayload(createWorldviewPayload(type)),
      });
      const newNodeId = (result?.result as { settingNode?: { id: string } })?.settingNode?.id;
      if (newNodeId) {
        setSelectedNodeId(newNodeId);
      }
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
      if (focusNodeId === nodeId) {
        setFocusNodeId(null);
      }
      // 如果删除的是右键菜单打开的节点，关闭菜单
      if (contextMenu.nodeId === nodeId) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    },
    [onMutate, selectedNodeId, focusNodeId, contextMenu.nodeId]
  );

  const handleMoveNode = useCallback(
    async (nodeId: string, newParentId: string | null) => {
      const result = await onMutate('move-worldview-node', {
        nodeId,
        parentId: newParentId,
      });
      const movedNode = (result?.result as { settingNode?: { id: string; parentId: string | null } })?.settingNode;

      if (movedNode) {
        setFocusNodeId(nodeId);
        const path = getNodePath(tree, nodeId);
        if (path.length > 0) {
          const newRootId = path[0].id;
          setActiveRootId(newRootId);
          path.forEach((node) => {
            if (node.id !== nodeId) {
              setExpandedIds((prev) => new Set([...prev, node.id]));
            }
          });
        }
      }
    },
    [onMutate, tree]
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
    async (parentId: string, orderedIds: string[]) => {
      await onMutate('reorder-worldview-siblings', {
        workId,
        parentId: parentId || null,
        orderedIds,
      });
    },
    [onMutate, workId]
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

  // 处理节点右键菜单
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      
      // 找到节点数据
      const nodeData = findNodeInTree(tree, node.id);
      if (!nodeData) return;

      // 设置右键菜单位置和状态
      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        nodeData: {
          title: nodeData.title,
          type: nodeData.nodeType,
          hasChildren: nodeData.children.length > 0,
          isRoot: !nodeData.parentId,
          note: nodeData.payload.note,
          value: nodeData.payload.value,
        } as NodeData,
      });
    },
    [tree]
  );

  // 关闭右键菜单
  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 优先关闭右键菜单
        if (contextMenu.visible) {
          closeContextMenu();
          return;
        }
        if (selectedNodeId) {
          setSelectedNodeId(null);
        } else if (focusNodeId) {
          setFocusNodeId(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, selectedNodeId, focusNodeId, contextMenu.visible, closeContextMenu]);

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
    <>
      <div className="settings-overlay">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[60] w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors bg-background/80 backdrop-blur-sm shadow-sm border"
          title="关闭 (Esc)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        <div className="settings-layout">
          <div className="border-r flex flex-col overflow-hidden bg-muted/20">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold mb-3">世界观</h2>
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
                        const path = getNodePath(tree, item.id);
                        const rootId = path[0]?.id;
                        if (rootId) {
                          setActiveRootId(rootId);
                        }
                        setSelectedNodeId(null);
                        setFocusNodeId(item.id);
                      }}
                      className={cx(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                        focusNodeId === item.id
                          ? 'bg-gray-900 text-white'
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
                            className={cx(
                              'text-xs cursor-pointer',
                              focusNodeId === item.id ? 'text-white' : ''
                            )}
                          >
                            {item.expanded ? '▼' : '▶'}
                          </span>
                        )}
                        <span className="truncate">{item.title}</span>
                        <span className={cx(
                          'text-xs opacity-60 ml-auto',
                          focusNodeId === item.id ? 'text-white' : ''
                        )}>
                          {item.type === 'group' ? '组' : '条'}
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
                onSelectNode={setSelectedNodeId}
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
                          onClick={() => {
                            setActiveRootId(root.id);
                            setFocusNodeId(null);
                          }}
                          className={cx(
                            'px-3 py-1 text-xs rounded-md whitespace-nowrap transition-colors',
                            effectiveActiveRootId === root.id
                              ? 'bg-gray-900 text-white'
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
                    onSelectNode={(nodeId) => {
                      setSelectedNodeId(nodeId);
                      setFocusNodeId(null);
                    }}
                    focusNodeId={focusNodeId}
                    onContextMenu={handleNodeContextMenu}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-muted-foreground mb-4">暂无节点</p>
                      <button
                        onClick={() => handleCreateNode('group', null)}
                        className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
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

      <NodeContextMenu
        key={`ctx-menu-${contextMenu.nodeId || 'none'}`}
        state={contextMenu}
        onClose={closeContextMenu}
        onCreateChild={handleCreateNode}
        onDeleteNode={handleDeleteNode}
        onMoveNode={handleMoveNode}
        nodes={nodes}
      />
    </>
  );
}
