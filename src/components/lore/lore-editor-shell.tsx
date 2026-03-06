"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { MarkdownPreview } from "@/components/lore/markdown-renderer";

type WorldbuildingNode = {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type TreeNode = WorldbuildingNode & {
  children: TreeNode[];
  depth: number;
};

type LoreEditorShellProps = {
  projectId: string | null;
};

type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = { success: false; error: { code: string; message: string } };
type ApiResult<T> = ApiSuccess<T> | ApiFailure;

async function apiRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    headers: { "content-type": "application/json", ...options?.headers },
    ...options,
  });
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || !payload.success) {
    if (!payload.success) throw new Error(payload.error.message);
    throw new Error("Request failed");
  }
  return payload.data;
}

function buildTree(nodes: WorldbuildingNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const node of nodes) {
    map.set(node.id, { ...node, children: [], depth: 0 });
  }

  for (const node of nodes) {
    const treeNode = map.get(node.id)!;
    if (node.parentId && map.has(node.parentId)) {
      const parent = map.get(node.parentId)!;
      treeNode.depth = parent.depth + 1;
      parent.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  function fixDepth(node: TreeNode, depth: number) {
    node.depth = depth;
    for (const child of node.children) {
      fixDepth(child, depth + 1);
    }
  }
  for (const root of roots) {
    fixDepth(root, 0);
  }

  function sortChildren(nodeList: TreeNode[]) {
    nodeList.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const node of nodeList) {
      sortChildren(node.children);
    }
  }
  sortChildren(roots);

  return roots;
}

function flattenTree(roots: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(nodes: TreeNode[]) {
    for (const node of nodes) {
      result.push(node);
      walk(node.children);
    }
  }
  walk(roots);
  return result;
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MoveUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 11V3M4 6l3-3 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoveDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 3v8M4 8l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type TreeNodeRowProps = {
  node: TreeNode;
  isSelected: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onAddChild: (parentId: string) => void;
};

function TreeNodeRow({
  node,
  isSelected,
  isExpanded,
  hasChildren,
  onSelect,
  onToggleExpand,
  onAddChild,
}: TreeNodeRowProps) {
  const paddingLeft = 12 + node.depth * 20;
  const isRoot = node.depth === 0;

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
      className={[
        "group flex items-center gap-1 cursor-pointer transition-all rounded-md",
        "hover:bg-muted/80",
        isSelected
          ? "bg-accent text-accent-foreground shadow-sm"
          : "text-foreground",
      ].join(" ")}
      style={{ paddingLeft: `${paddingLeft}px`, paddingRight: "8px" }}
      onClick={() => onSelect(node.id)}
    >
      <button
        type="button"
        className={[
          "flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-transform",
          hasChildren ? "visible" : "invisible",
          isSelected ? "text-accent-foreground/80" : "text-muted-foreground",
        ].join(" ")}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand(node.id);
        }}
        tabIndex={-1}
      >
        <ChevronRight
          className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
        />
      </button>

      <span
        className={[
          "flex-1 truncate py-2 text-sm",
          isRoot ? "font-semibold" : "font-normal",
          isSelected ? "" : "text-foreground",
        ].join(" ")}
        title={node.name}
      >
        {node.name}
      </span>

      <button
        type="button"
        className={[
          "flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-opacity",
          "opacity-0 group-hover:opacity-100 hover:bg-black/10",
          isSelected ? "text-accent-foreground/80" : "text-muted-foreground",
        ].join(" ")}
        onClick={(e) => {
          e.stopPropagation();
          onAddChild(node.id);
        }}
        title="添加子节点"
        tabIndex={-1}
      >
        <PlusIcon />
      </button>
    </div>
  );
}

export function LoreEditorShell({ projectId }: LoreEditorShellProps) {
  const [nodes, setNodes] = useState<WorldbuildingNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [creatingChildOf, setCreatingChildOf] = useState<string | null | undefined>(undefined);
  const [newNodeName, setNewNodeName] = useState("");

  const nameInputRef = useRef<HTMLInputElement>(null);
  const lastProjectIdRef = useRef<string | null>(projectId);
  const loadSeqRef = useRef(0);

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const flat = useMemo(() => flattenTree(tree), [tree]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const selectedTreeNode = useMemo(
    () => flat.find((n) => n.id === selectedNodeId) ?? null,
    [flat, selectedNodeId],
  );

  useEffect(() => {
    if (lastProjectIdRef.current === projectId) return;
    lastProjectIdRef.current = projectId;
    setNodes([]);
    setSelectedNodeId(null);
    setExpandedIds(new Set());
    setError(null);
    setNotice(null);
    setDraftName("");
    setDraftDescription("");
    setPreviewMode(false);
    setCreatingChildOf(undefined);
  }, [projectId]);

  const loadNodes = useCallback(async () => {
    if (!projectId) {
      setNodes([]);
      return;
    }

    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest<{ nodes: WorldbuildingNode[] }>(
        `/api/projects/${projectId}/worldbuilding`,
      );
      if (seq !== loadSeqRef.current) return;
      setNodes(data.nodes);

      if (data.nodes.length > 0 && !selectedNodeId) {
        const roots = data.nodes.filter((n) => !n.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
        const firstRoot = roots[0] ?? data.nodes[0]!;
        setSelectedNodeId(firstRoot.id);
        setDraftName(firstRoot.name);
        setDraftDescription(firstRoot.description);
        setExpandedIds(new Set(roots.map((n) => n.id)));
      }
    } catch (reason) {
      if (seq !== loadSeqRef.current) return;
      setError(reason instanceof Error ? reason.message : "加载设定集失败");
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [projectId, selectedNodeId]);

  useEffect(() => {
    if (!projectId) {
      setNodes([]);
      setSelectedNodeId(null);
      setLoading(false);
      return;
    }
    void loadNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const selectNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setSelectedNodeId(nodeId);
      setDraftName(node.name);
      setDraftDescription(node.description);
      setPreviewMode(false);
      setCreatingChildOf(undefined);
      setError(null);
      setNotice(null);
    },
    [nodes],
  );

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const startCreateChild = useCallback((parentId: string | null) => {
    setCreatingChildOf(parentId);
    setNewNodeName("");
    setError(null);
    setNotice(null);
    if (parentId) {
      setExpandedIds((prev) => new Set(prev).add(parentId));
    }
  }, []);

  const cancelCreate = useCallback(() => {
    setCreatingChildOf(undefined);
    setNewNodeName("");
  }, []);

  async function handleCreateNode(e?: FormEvent) {
    e?.preventDefault();
    if (!projectId) return;

    const name = newNodeName.trim();
    if (!name) {
      setError("节点名称不能为空");
      return;
    }

    const parentId = creatingChildOf === undefined ? null : creatingChildOf;

    setSaving(true);
    setError(null);
    try {
      const created = await apiRequest<WorldbuildingNode>(
        `/api/projects/${projectId}/worldbuilding`,
        {
          method: "POST",
          body: JSON.stringify({ parentId, name }),
        },
      );
      setCreatingChildOf(undefined);
      setNewNodeName("");
      setNotice(`节点「${created.name}」已创建`);

      await loadNodes();
      setSelectedNodeId(created.id);
      setDraftName(created.name);
      setDraftDescription(created.description);
      if (parentId) {
        setExpandedIds((prev) => new Set(prev).add(parentId));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建节点失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!projectId || !selectedNodeId) return;

    const name = draftName.trim();
    if (!name) {
      setError("节点名称不能为空");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest<WorldbuildingNode>(
        `/api/projects/${projectId}/worldbuilding/${selectedNodeId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name, description: draftDescription }),
        },
      );
      setNotice("设定已保存");
      await loadNodes();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!projectId || !selectedNode) return;
    const childCount = flat.filter(
      (n) => n.id !== selectedNode.id && isDescendant(flat, selectedNode.id, n.id),
    ).length;
    const extra = childCount > 0 ? `（包含 ${childCount} 个子节点）` : "";
    if (!window.confirm(`确认删除「${selectedNode.name}」${extra}？此操作不可撤销。`)) return;

    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest<{ deleted: boolean }>(
        `/api/projects/${projectId}/worldbuilding/${selectedNode.id}`,
        { method: "DELETE" },
      );
      setNotice(`「${selectedNode.name}」已删除`);
      setSelectedNodeId(null);
      setDraftName("");
      setDraftDescription("");
      await loadNodes();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  async function handleMoveUp() {
    if (!projectId || !selectedTreeNode) return;
    const siblings = getSiblings(flat, selectedTreeNode);
    const idx = siblings.findIndex((n) => n.id === selectedTreeNode.id);
    if (idx <= 0) return;
    const ids = siblings.map((n) => n.id);
    [ids[idx - 1], ids[idx]] = [ids[idx]!, ids[idx - 1]!];
    await doReorder(selectedTreeNode.parentId, ids);
  }

  async function handleMoveDown() {
    if (!projectId || !selectedTreeNode) return;
    const siblings = getSiblings(flat, selectedTreeNode);
    const idx = siblings.findIndex((n) => n.id === selectedTreeNode.id);
    if (idx < 0 || idx >= siblings.length - 1) return;
    const ids = siblings.map((n) => n.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1]!, ids[idx]!];
    await doReorder(selectedTreeNode.parentId, ids);
  }

  async function doReorder(parentId: string | null, orderedIds: string[]) {
    if (!projectId) return;
    setError(null);
    try {
      await apiRequest<{ nodes: WorldbuildingNode[] }>(
        `/api/projects/${projectId}/worldbuilding/reorder`,
        {
          method: "POST",
          body: JSON.stringify({ parentId, orderedIds }),
        },
      );
      await loadNodes();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "排序失败");
    }
  }

  function handleNewNodeKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCreateNode();
    }
    if (e.key === "Escape") {
      cancelCreate();
    }
  }

  function renderTreeNodes(treeNodes: TreeNode[]): ReactNode[] {
    const result: ReactNode[] = [];

    for (const node of treeNodes) {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedIds.has(node.id);
      const isSelected = node.id === selectedNodeId;

      result.push(
        <TreeNodeRow
          key={node.id}
          node={node}
          isSelected={isSelected}
          isExpanded={isExpanded}
          hasChildren={hasChildren}
          onSelect={selectNode}
          onToggleExpand={toggleExpand}
          onAddChild={(parentId) => startCreateChild(parentId)}
        />,
      );

      if (creatingChildOf === node.id) {
        result.push(
          <div
            key={`create-${node.id}`}
            className="flex items-center gap-1 py-1"
            style={{ paddingLeft: `${12 + (node.depth + 1) * 20}px`, paddingRight: "8px" }}
          >
            <input
              autoFocus
              className="flex-1 text-sm px-2 py-1 rounded border border-accent bg-background"
              placeholder="输入节点名称..."
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              onKeyDown={handleNewNodeKeyDown}
              disabled={saving}
            />
            <button
              type="button"
              className="primary text-xs px-2 py-1"
              onClick={() => void handleCreateNode()}
              disabled={saving || !newNodeName.trim()}
            >
              {saving ? "..." : "确定"}
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1"
              onClick={cancelCreate}
              disabled={saving}
            >
              取消
            </button>
          </div>,
        );
      }

      if (hasChildren && isExpanded) {
        result.push(...renderTreeNodes(node.children));
      }
    }

    return result;
  }

  const canMoveUp = selectedTreeNode
    ? getSiblings(flat, selectedTreeNode).findIndex((n) => n.id === selectedTreeNode.id) > 0
    : false;

  const canMoveDown = selectedTreeNode
    ? (() => {
        const siblings = getSiblings(flat, selectedTreeNode);
        const idx = siblings.findIndex((n) => n.id === selectedTreeNode.id);
        return idx >= 0 && idx < siblings.length - 1;
      })()
    : false;

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">设定集</h1>
          <p className="text-xs text-muted-foreground">
            树形管理世界观、角色、地点等设定 — 一级节点将在对话中自动注入
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadNodes()}
            disabled={loading || !projectId}
          >
            {loading ? "刷新中..." : "刷新"}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {!projectId ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center cn-panel max-w-md">
              <h2 className="cn-card-title">暂无项目</h2>
              <p className="cn-card-description">请先在左侧选择或创建项目，再编辑设定集。</p>
            </div>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Tree Panel */}
            <div className="w-72 min-w-[260px] border-r border-border flex flex-col h-full">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  节点树
                </span>
                <button
                  type="button"
                  className="h-7 w-7 p-0 flex items-center justify-center rounded-md hover:bg-muted"
                  onClick={() => startCreateChild(null)}
                  title="添加根节点"
                >
                  <PlusIcon className="text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-2 custom-scrollbar" role="tree">
                {loading && nodes.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <div className="text-sm text-muted-foreground">加载中...</div>
                  </div>
                ) : nodes.length === 0 && !loading ? (
                  <div className="px-4 py-8 text-center space-y-3">
                    <div className="text-sm text-muted-foreground">暂无设定节点</div>
                    <button
                      type="button"
                      className="primary text-xs px-3 py-1.5"
                      onClick={() => startCreateChild(null)}
                    >
                      创建第一个节点
                    </button>
                  </div>
                ) : (
                  <>
                    {creatingChildOf === null && (
                      <div className="flex items-center gap-1 py-1 px-3 mb-1">
                        <input
                          autoFocus
                          className="flex-1 text-sm px-2 py-1 rounded border border-accent bg-background"
                          placeholder="输入根节点名称..."
                          value={newNodeName}
                          onChange={(e) => setNewNodeName(e.target.value)}
                          onKeyDown={handleNewNodeKeyDown}
                          disabled={saving}
                        />
                        <button
                          type="button"
                          className="primary text-xs px-2 py-1"
                          onClick={() => void handleCreateNode()}
                          disabled={saving || !newNodeName.trim()}
                        >
                          {saving ? "..." : "确定"}
                        </button>
                        <button
                          type="button"
                          className="text-xs px-2 py-1"
                          onClick={cancelCreate}
                          disabled={saving}
                        >
                          取消
                        </button>
                      </div>
                    )}
                    {renderTreeNodes(tree)}
                  </>
                )}
              </div>
            </div>

            {/* Editor Panel */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {error && (
                <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {notice && (
                <div className="mx-6 mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                  <p className="text-sm text-emerald-700">{notice}</p>
                </div>
              )}

              {selectedNode ? (
                <form className="p-6 space-y-5 max-w-4xl" onSubmit={handleSave}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <label className="block">
                        <span className="block text-xs text-muted-foreground mb-1 font-medium">
                          名称
                        </span>
                        <input
                          ref={nameInputRef}
                          className="w-full text-lg font-semibold"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          placeholder="节点名称"
                          required
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-1 self-end pb-0.5">
                      <button
                        type="button"
                        className="h-8 w-8 p-0 flex items-center justify-center rounded-md"
                        onClick={() => void handleMoveUp()}
                        disabled={!canMoveUp}
                        title="上移"
                      >
                        <MoveUpIcon />
                      </button>
                      <button
                        type="button"
                        className="h-8 w-8 p-0 flex items-center justify-center rounded-md"
                        onClick={() => void handleMoveDown()}
                        disabled={!canMoveDown}
                        title="下移"
                      >
                        <MoveDownIcon />
                      </button>
                    </div>
                  </div>

                  {selectedTreeNode && selectedTreeNode.depth === 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 border border-blue-200">
                      <span className="text-xs text-blue-700 font-medium">
                        一级节点 — 描述将在每次对话中自动注入作为世界观上下文
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground font-medium">
                        描述 (Markdown)
                      </span>
                      <div className="flex rounded-md border border-border overflow-hidden">
                        <button
                          type="button"
                          className={`text-xs px-3 py-1 rounded-none border-none ${!previewMode ? "bg-foreground text-background font-medium" : "bg-background text-muted-foreground hover:bg-muted"}`}
                          onClick={() => setPreviewMode(false)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className={`text-xs px-3 py-1 rounded-none border-none border-l border-border ${previewMode ? "bg-foreground text-background font-medium" : "bg-background text-muted-foreground hover:bg-muted"}`}
                          onClick={() => setPreviewMode(true)}
                        >
                          预览
                        </button>
                      </div>
                    </div>

                    {previewMode ? (
                      <div className="min-h-[320px] rounded-md border border-border p-4 bg-background overflow-y-auto">
                        <MarkdownPreview content={draftDescription} />
                      </div>
                    ) : (
                      <textarea
                        className="w-full min-h-[320px] font-mono text-sm leading-relaxed resize-y"
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        placeholder={"使用 Markdown 记录世界观、角色背景、魔法体系等设定...\n\n# 标题\n## 子标题\n\n**加粗** *斜体*\n\n- 列表项\n- 列表项"}
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <button
                      type="submit"
                      className="primary"
                      disabled={saving || !draftName.trim()}
                    >
                      {saving ? "保存中..." : "保存"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startCreateChild(selectedNode.id)}
                      disabled={saving}
                    >
                      添加子节点
                    </button>
                    <div className="flex-1" />
                    <button
                      type="button"
                      className="text-red-600 hover:bg-red-50 border-red-200"
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                    >
                      {deleting ? "删除中..." : "删除"}
                    </button>
                  </div>

                  <div className="text-xs text-muted-foreground pt-1">
                    <span className="font-mono">{selectedNode.id.slice(0, 8)}...</span>
                    <span className="mx-2">|</span>
                    <span>深度 {selectedTreeNode?.depth ?? 0}</span>
                    <span className="mx-2">|</span>
                    <span>
                      子节点 {selectedTreeNode?.children.length ?? 0} 个
                    </span>
                  </div>
                </form>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-3 max-w-sm">
                    <div className="text-lg text-muted-foreground/50 font-medium">
                      {nodes.length > 0
                        ? "选择一个节点开始编辑"
                        : "创建第一个设定节点"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      在左侧树中选择或创建节点，在此编辑名称和描述
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getSiblings(flat: TreeNode[], node: TreeNode): TreeNode[] {
  return flat.filter((n) => n.parentId === node.parentId && n.depth === node.depth);
}

function isDescendant(flat: TreeNode[], ancestorId: string, nodeId: string): boolean {
  let current = flat.find((n) => n.id === nodeId);
  while (current) {
    if (current.parentId === ancestorId) return true;
    current = flat.find((n) => n.id === current!.parentId);
  }
  return false;
}
