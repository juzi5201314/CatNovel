"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type LoreNodeType =
  | "character"
  | "location"
  | "item"
  | "organization"
  | "concept"
  | "other";

type LoreNode = {
  id: string;
  name: string;
  type: LoreNodeType;
  description: string | null;
  aliases: string[];
};

type ToolExecutionData =
  | {
      status: "executed";
      result: unknown;
    }
  | {
      status: "requires_approval";
      approvalId: string;
      summary: string;
    };

type PendingExecution = {
  id: string;
  approvalId: string;
  toolName: "lore.upsertNode" | "lore.deleteNode";
  args: unknown;
  label: string;
  status: "pending" | "running";
};

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type ApiResult<T> = ApiSuccess<T> | ApiFailure;

type LoreEditorShellProps = {
  projectId: string | null;
};

const LORE_TYPE_OPTIONS: Array<{ value: LoreNodeType; label: string }> = [
  { value: "character", label: "角色" },
  { value: "location", label: "地点" },
  { value: "item", label: "物品" },
  { value: "organization", label: "组织" },
  { value: "concept", label: "概念" },
  { value: "other", label: "其他" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNodeType(value: unknown): LoreNodeType {
  if (
    value === "character" ||
    value === "location" ||
    value === "item" ||
    value === "organization" ||
    value === "concept"
  ) {
    return value;
  }
  return "other";
}

function normalizeAliases(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const aliases: string[] = [];
  for (const item of input) {
    if (typeof item === "string") {
      const alias = item.trim();
      if (alias.length > 0) {
        aliases.push(alias);
      }
      continue;
    }
    if (!isRecord(item)) {
      continue;
    }
    const alias = asString(item.alias);
    if (alias) {
      aliases.push(alias);
    }
  }

  return [...new Set(aliases)];
}

function normalizeLoreNode(input: unknown): LoreNode | null {
  if (!isRecord(input)) {
    return null;
  }

  const id = asString(input.id);
  const name = asString(input.name);
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    type: normalizeNodeType(input.type),
    description: typeof input.description === "string" ? input.description : null,
    aliases: normalizeAliases(input.aliases),
  };
}

function normalizeLoreNodes(input: unknown): LoreNode[] {
  if (!isRecord(input) || !Array.isArray(input.nodes)) {
    return [];
  }

  return input.nodes
    .map((item) => normalizeLoreNode(item))
    .filter((item): item is LoreNode => item !== null);
}

function extractNodeIdFromUpsertResult(input: unknown): string | null {
  if (!isRecord(input)) {
    return null;
  }

  if (isRecord(input.node)) {
    return asString(input.node.id);
  }
  return null;
}

function parseToolExecutionData(input: unknown): ToolExecutionData {
  if (!isRecord(input)) {
    throw new Error("工具响应格式不正确");
  }

  if (input.status === "executed") {
    return {
      status: "executed",
      result: input.result,
    };
  }

  if (input.status === "requires_approval") {
    const approvalId = asString(input.approvalId);
    if (!approvalId) {
      throw new Error("审批响应缺少 approvalId");
    }
    return {
      status: "requires_approval",
      approvalId,
      summary: asString(input.summary) ?? "请求需要审批",
    };
  }

  throw new Error("未知工具执行状态");
}

function parseApprovalStatus(input: unknown): string | null {
  if (!isRecord(input)) {
    return null;
  }
  return asString(input.status);
}

function toErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  if (typeof reason === "string" && reason.trim().length > 0) {
    return reason;
  }
  return fallback;
}

async function parseApiData<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || !payload.success) {
    if (!payload.success) {
      throw new Error(payload.error.message);
    }
    throw new Error("request failed");
  }
  return payload.data;
}

function parseAliasesInput(raw: string): string[] {
  return [...new Set(raw.split(/[\n,，]/).map((item) => item.trim()).filter((item) => item.length > 0))];
}

export function LoreEditorShell({ projectId }: LoreEditorShellProps) {
  const [nodes, setNodes] = useState<LoreNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [queryInput, setQueryInput] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<LoreNodeType | "all">("all");

  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState<LoreNodeType>("character");
  const [draftAliases, setDraftAliases] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  const [pendingExecutions, setPendingExecutions] = useState<PendingExecution[]>([]);

  const [loadingNodes, setLoadingNodes] = useState(false);
  const [savingNode, setSavingNode] = useState(false);
  const [deletingNode, setDeletingNode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedNodeIdRef = useRef<string | null>(selectedNodeId);
  const isCreatingRef = useRef<boolean>(isCreating);
  const loadRequestSeqRef = useRef(0);
  const lastProjectIdRef = useRef<string | null>(projectId);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    isCreatingRef.current = isCreating;
  }, [isCreating]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const resetDraft = useCallback(() => {
    setDraftName("");
    setDraftType("character");
    setDraftAliases("");
    setDraftDescription("");
  }, []);

  const applyNodeToDraft = useCallback((node: LoreNode) => {
    setDraftName(node.name);
    setDraftType(node.type);
    setDraftAliases(node.aliases.join(", "));
    setDraftDescription(node.description ?? "");
  }, []);

  useEffect(() => {
    if (lastProjectIdRef.current === projectId) {
      return;
    }
    lastProjectIdRef.current = projectId;
    setPendingExecutions([]);
    setError(null);
    setNotice(null);
    setSelectedNodeId(null);
    setIsCreating(false);
    resetDraft();
  }, [projectId, resetDraft]);

  const executeTool = useCallback(
    async (input: {
      projectId: string;
      toolName: "lore.listNodes" | "lore.upsertNode" | "lore.deleteNode";
      args?: unknown;
      approvalId?: string;
    }): Promise<ToolExecutionData> => {
      const response = await fetch("/api/tools/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const data = await parseApiData<unknown>(response);
      return parseToolExecutionData(data);
    },
    [],
  );

  const queuePendingExecution = useCallback(
    (item: Omit<PendingExecution, "id" | "status">) => {
      setPendingExecutions((current) => {
        if (current.some((pending) => pending.approvalId === item.approvalId)) {
          return current;
        }
        return [
          ...current,
          {
            ...item,
            id: crypto.randomUUID(),
            status: "pending",
          },
        ];
      });
    },
    [],
  );

  const loadNodes = useCallback(async () => {
    if (!projectId) {
      setNodes([]);
      setSelectedNodeId(null);
      setIsCreating(false);
      resetDraft();
      return;
    }

    const requestId = ++loadRequestSeqRef.current;

    setLoadingNodes(true);
    setError(null);
    try {
      const args: Record<string, unknown> = {
        limit: 200,
      };
      if (appliedQuery.length > 0) {
        args.query = appliedQuery;
      }
      if (typeFilter !== "all") {
        args.type = typeFilter;
      }

      const execution = await executeTool({
        projectId,
        toolName: "lore.listNodes",
        args,
      });

      if (requestId !== loadRequestSeqRef.current) {
        return;
      }

      if (execution.status !== "executed") {
        setError("设定节点读取请求进入审批，暂时无法展示列表。");
        return;
      }

      const nextNodes = normalizeLoreNodes(execution.result);
      setNodes(nextNodes);

      if (isCreatingRef.current) {
        return;
      }

      const currentSelectedId = selectedNodeIdRef.current;
      if (currentSelectedId && nextNodes.some((item) => item.id === currentSelectedId)) {
        return;
      }

      const fallbackNode = nextNodes[0];
      if (!fallbackNode) {
        setSelectedNodeId(null);
        resetDraft();
        return;
      }

      setSelectedNodeId(fallbackNode.id);
      applyNodeToDraft(fallbackNode);
    } catch (reason) {
      if (requestId === loadRequestSeqRef.current) {
        setError(toErrorMessage(reason, "设定节点加载失败"));
      }
    } finally {
      if (requestId === loadRequestSeqRef.current) {
        setLoadingNodes(false);
      }
    }
  }, [appliedQuery, applyNodeToDraft, executeTool, projectId, resetDraft, typeFilter]);

  useEffect(() => {
    if (!projectId) {
      setNodes([]);
      setSelectedNodeId(null);
      setIsCreating(false);
      setPendingExecutions([]);
      setLoadingNodes(false);
      setSavingNode(false);
      setDeletingNode(false);
      setError(null);
      setNotice(null);
      resetDraft();
      return;
    }

    void loadNodes();
  }, [loadNodes, projectId, resetDraft]);

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedQuery(queryInput.trim());
  }

  function handleCreateNode() {
    setIsCreating(true);
    setSelectedNodeId(null);
    resetDraft();
    setError(null);
    setNotice("已切换到新建设定节点。");
  }

  function handleSelectNode(node: LoreNode) {
    setIsCreating(false);
    setSelectedNodeId(node.id);
    applyNodeToDraft(node);
    setError(null);
  }

  async function handleSaveNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId) {
      return;
    }

    const name = draftName.trim();
    if (name.length === 0) {
      setError("节点名称不能为空");
      return;
    }

    setSavingNode(true);
    setError(null);
    setNotice(null);

    const args: Record<string, unknown> = {
      name,
      type: draftType,
      aliases: parseAliasesInput(draftAliases),
      description: draftDescription.trim().length > 0 ? draftDescription.trim() : null,
    };
    if (!isCreating && selectedNodeId) {
      args.nodeId = selectedNodeId;
    }

    try {
      const execution = await executeTool({
        projectId,
        toolName: "lore.upsertNode",
        args,
      });

      if (execution.status === "requires_approval") {
        queuePendingExecution({
          approvalId: execution.approvalId,
          toolName: "lore.upsertNode",
          args,
          label: `保存节点「${name}」`,
        });
        setNotice("保存请求已提交审批。请在右侧 Tasks 面板通过后，点击“执行已批准请求”。");
        return;
      }

      const nodeId = extractNodeIdFromUpsertResult(execution.result);
      if (nodeId) {
        setSelectedNodeId(nodeId);
      }
      setIsCreating(false);
      setNotice("设定节点已保存。");
      await loadNodes();
    } catch (reason) {
      setError(toErrorMessage(reason, "设定节点保存失败"));
    } finally {
      setSavingNode(false);
    }
  }

  async function handleDeleteNode() {
    if (!projectId || !selectedNode) {
      return;
    }

    setDeletingNode(true);
    setError(null);
    setNotice(null);

    const args = {
      nodeId: selectedNode.id,
    };

    try {
      const execution = await executeTool({
        projectId,
        toolName: "lore.deleteNode",
        args,
      });

      if (execution.status === "requires_approval") {
        queuePendingExecution({
          approvalId: execution.approvalId,
          toolName: "lore.deleteNode",
          args,
          label: `删除节点「${selectedNode.name}」`,
        });
        setNotice("删除请求已提交审批。请在右侧 Tasks 面板通过后，点击“执行已批准请求”。");
        return;
      }

      setIsCreating(true);
      setSelectedNodeId(null);
      resetDraft();
      setNotice("设定节点已删除。");
      await loadNodes();
    } catch (reason) {
      setError(toErrorMessage(reason, "设定节点删除失败"));
    } finally {
      setDeletingNode(false);
    }
  }

  async function handleExecutePending(pendingId: string) {
    const pending = pendingExecutions.find((item) => item.id === pendingId);
    if (!projectId || !pending) {
      return;
    }

    setPendingExecutions((current) =>
      current.map((item) =>
        item.id === pendingId ? { ...item, status: "running" } : item,
      ),
    );
    setError(null);
    setNotice(null);

    try {
      const detailResponse = await fetch(`/api/tool-approvals/${pending.approvalId}`, {
        method: "GET",
      });
      const detail = await parseApiData<unknown>(detailResponse);
      const approvalStatus = parseApprovalStatus(detail);

      if (!approvalStatus) {
        throw new Error("审批状态读取失败");
      }

      if (approvalStatus === "pending") {
        setNotice(`审批 ${pending.approvalId} 仍在等待通过。`);
        return;
      }

      if (approvalStatus === "rejected" || approvalStatus === "expired") {
        setPendingExecutions((current) =>
          current.filter((item) => item.id !== pendingId),
        );
        setError(`审批 ${pending.approvalId} 状态为 ${approvalStatus}，请求已移出队列。`);
        return;
      }

      if (approvalStatus === "executed") {
        setPendingExecutions((current) =>
          current.filter((item) => item.id !== pendingId),
        );
        setNotice(`${pending.label}已执行完成。`);
        await loadNodes();
        return;
      }

      if (approvalStatus !== "approved") {
        setError(`未知审批状态：${approvalStatus}`);
        return;
      }

      const execution = await executeTool({
        projectId,
        toolName: pending.toolName,
        args: pending.args,
        approvalId: pending.approvalId,
      });

      if (execution.status !== "executed") {
        setError("审批已通过，但执行尚未完成。");
        return;
      }

      setPendingExecutions((current) =>
        current.filter((item) => item.id !== pendingId),
      );

      if (pending.toolName === "lore.upsertNode") {
        const nodeId = extractNodeIdFromUpsertResult(execution.result);
        if (nodeId) {
          setSelectedNodeId(nodeId);
        }
        setIsCreating(false);
      } else {
        setIsCreating(true);
        setSelectedNodeId(null);
        resetDraft();
      }

      setNotice(`${pending.label}已执行。`);
      await loadNodes();
    } catch (reason) {
      setError(toErrorMessage(reason, "执行审批请求失败"));
    } finally {
      setPendingExecutions((current) =>
        current.map((item) =>
          item.id === pendingId ? { ...item, status: "pending" } : item,
        ),
      );
    }
  }

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">设定集编辑器</h1>
          <p className="text-xs text-muted-foreground">
            管理角色、地点、组织、概念等设定节点
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadNodes()} disabled={loadingNodes || !projectId}>
            {loadingNodes ? "刷新中..." : "刷新"}
          </button>
          <button type="button" className="primary" onClick={handleCreateNode} disabled={!projectId}>
            新建节点
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar bg-muted/10">
        {!projectId ? (
          <div className="max-w-4xl mx-auto cn-panel">
            <h2 className="cn-card-title">暂无项目</h2>
            <p className="cn-card-description">请先在左侧选择或创建项目，再编辑设定集。</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-4">
            <section className="cn-panel">
              <form className="flex flex-wrap items-end gap-3" onSubmit={handleSearchSubmit}>
                <label className="flex-1 min-w-[220px]">
                  <span className="block text-xs text-muted-foreground mb-1">关键词</span>
                  <input
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                    placeholder="按名称或别名搜索"
                  />
                </label>
                <label className="w-[180px]">
                  <span className="block text-xs text-muted-foreground mb-1">节点类型</span>
                  <select
                    value={typeFilter}
                    onChange={(event) => {
                      const nextValue = event.target.value as LoreNodeType | "all";
                      setTypeFilter(nextValue);
                    }}
                  >
                    <option value="all">全部类型</option>
                    {LORE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">应用筛选</button>
              </form>
            </section>

            {error ? (
              <section className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </section>
            ) : null}

            {notice ? (
              <section className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm text-emerald-700">{notice}</p>
              </section>
            ) : null}

            {pendingExecutions.length > 0 ? (
              <section className="cn-panel">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">待执行审批请求</h2>
                  <span className="text-xs text-muted-foreground">{pendingExecutions.length} 条</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {pendingExecutions.map((item) => (
                    <li key={item.id} className="rounded-md border border-border p-3">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        approvalId: <span className="font-mono">{item.approvalId}</span>
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleExecutePending(item.id)}
                          disabled={item.status === "running"}
                        >
                          {item.status === "running" ? "处理中..." : "执行已批准请求"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingExecutions((current) =>
                              current.filter((pending) => pending.id !== item.id),
                            )
                          }
                          disabled={item.status === "running"}
                        >
                          移除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
              <section className="cn-panel">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">节点列表</h2>
                  <span className="text-xs text-muted-foreground">共 {nodes.length} 个</span>
                </div>
                {loadingNodes ? <p className="cn-card-description">加载中...</p> : null}
                <ul className="mt-3 space-y-1 max-h-[640px] overflow-y-auto pr-1 custom-scrollbar">
                  {nodes.map((node) => {
                    const active = !isCreating && node.id === selectedNodeId;
                    return (
                      <li key={node.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectNode(node)}
                          className={[
                            "w-full text-left px-3 py-2.5 rounded-md border transition-all",
                            active
                              ? "bg-accent text-accent-foreground border-accent"
                              : "border-transparent hover:bg-muted",
                          ].join(" ")}
                        >
                          <span className="block text-sm font-semibold truncate">{node.name}</span>
                          <span
                            className={[
                              "block text-xs mt-1",
                              active ? "text-white/70" : "text-muted-foreground",
                            ].join(" ")}
                          >
                            {LORE_TYPE_OPTIONS.find((option) => option.value === node.type)?.label ?? "其他"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {nodes.length === 0 && !loadingNodes ? (
                    <li>
                      <p className="cn-card-description">当前筛选下暂无设定节点。</p>
                    </li>
                  ) : null}
                </ul>
              </section>

              <section className="cn-panel">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">
                    {isCreating ? "新建设定节点" : selectedNode ? `编辑：${selectedNode.name}` : "设定节点"}
                  </h2>
                  {!isCreating && selectedNode ? (
                    <span className="text-xs text-muted-foreground font-mono">{selectedNode.id}</span>
                  ) : null}
                </div>

                <form className="mt-3 space-y-3" onSubmit={handleSaveNode}>
                  <label className="block">
                    <span className="block text-xs text-muted-foreground mb-1">名称</span>
                    <input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      placeholder="例如：阿尔卡迪亚王城"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs text-muted-foreground mb-1">类型</span>
                    <select
                      value={draftType}
                      onChange={(event) => setDraftType(event.target.value as LoreNodeType)}
                    >
                      {LORE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="block text-xs text-muted-foreground mb-1">别名（逗号分隔）</span>
                    <input
                      value={draftAliases}
                      onChange={(event) => setDraftAliases(event.target.value)}
                      placeholder="例如：王都, 中央城"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs text-muted-foreground mb-1">描述</span>
                    <textarea
                      rows={14}
                      value={draftDescription}
                      onChange={(event) => setDraftDescription(event.target.value)}
                      placeholder="记录核心设定、约束、背景信息..."
                    />
                  </label>

                  <div className="flex items-center gap-2">
                    <button type="submit" className="primary" disabled={savingNode || !projectId}>
                      {savingNode ? "保存中..." : "保存节点"}
                    </button>
                    {!isCreating && selectedNode ? (
                      <button
                        type="button"
                        disabled={deletingNode || !projectId}
                        onClick={() => void handleDeleteNode()}
                      >
                        {deletingNode ? "删除中..." : "删除节点"}
                      </button>
                    ) : null}
                  </div>
                </form>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
