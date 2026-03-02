import type { ToolApprovalStatus } from "@/db/schema";

const TRANSITIONS: Record<ToolApprovalStatus, readonly ToolApprovalStatus[]> = {
  pending: ["approved", "rejected", "expired"],
  approved: ["executed", "expired"],
  rejected: [],
  expired: [],
  executed: [],
};

export function canTransitToolApproval(
  from: ToolApprovalStatus,
  to: ToolApprovalStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertToolApprovalTransition(
  from: ToolApprovalStatus,
  to: ToolApprovalStatus,
): void {
  if (!canTransitToolApproval(from, to)) {
    throw new Error(`invalid tool approval transition: ${from} -> ${to}`);
  }
}
