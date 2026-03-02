"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ApprovalItem = {
  id: string;
  projectId: string;
  toolName: string;
  riskLevel: "read" | "write" | "high_risk";
  status: "pending" | "approved" | "rejected" | "expired" | "executed";
  reason?: string | null;
  requestedAt: string;
  expiresAt?: string | null;
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

type ApprovalCenterProps = {
  projectId: string | null;
};

async function parseApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.success ? "request failed" : payload.error.message);
  }
  return payload.data;
}

export function ApprovalCenter({ projectId }: ApprovalCenterProps) {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => approvals.filter((item) => item.status === "pending").length,
    [approvals],
  );

  const loadPendingApprovals = useCallback(async () => {
    if (!projectId) {
      setApprovals([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/tool-approvals?projectId=${projectId}&status=pending`,
      );
      const data = await parseApi<ApprovalItem[]>(response);
      setApprovals(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "审批列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const updateApprovalStatus = useCallback(
    async (id: string, action: "approve" | "reject") => {
      setBusyId(id);
      setError(null);
      try {
        const response = await fetch(`/api/tool-approvals/${id}/${action}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({}),
        });
        await parseApi<{ status: string }>(response);
        await loadPendingApprovals();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "审批操作失败");
      } finally {
        setBusyId(null);
      }
    },
    [loadPendingApprovals],
  );

  useEffect(() => {
    void loadPendingApprovals();
  }, [loadPendingApprovals]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const eventSource = new EventSource(
      `/api/tool-approvals/stream?projectId=${projectId}`,
    );

    const handler = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as {
          approvals?: ApprovalItem[];
        };
        if (Array.isArray(payload.approvals)) {
          setApprovals(payload.approvals);
        }
      } catch {
        // 忽略单条坏消息，保持订阅不断开。
      }
    };

    eventSource.addEventListener("tool_approvals_snapshot", handler as EventListener);
    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.removeEventListener(
        "tool_approvals_snapshot",
        handler as EventListener,
      );
      eventSource.close();
    };
  }, [projectId]);

  return (
    <article className="cn-panel">
      <h3 className="cn-card-title">审批中心</h3>
      <p className="cn-card-description">待审批：{pendingCount}</p>

      {!projectId ? (
        <p className="cn-card-description">请选择项目后查看审批请求。</p>
      ) : null}
      {loading ? <p className="cn-card-description">加载中...</p> : null}
      {error ? <p className="cn-card-description">{error}</p> : null}

      <ul className="mt-3 flex flex-col gap-2">
        {approvals.map((approval) => (
          <li key={approval.id} className="rounded-md border border-[var(--cn-border)] p-3">
            <p className="text-sm font-semibold text-[var(--cn-text-primary)]">
              {approval.toolName}
            </p>
            <p className="text-xs text-[var(--cn-text-secondary)]">
              风险级别：{approval.riskLevel}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void updateApprovalStatus(approval.id, "approve")}
                disabled={busyId === approval.id}
              >
                通过
              </button>
              <button
                type="button"
                onClick={() => void updateApprovalStatus(approval.id, "reject")}
                disabled={busyId === approval.id}
              >
                拒绝
              </button>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
