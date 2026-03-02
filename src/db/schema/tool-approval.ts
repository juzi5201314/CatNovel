import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const TOOL_RISK_LEVELS = ["read", "write", "high_risk"] as const;
export const TOOL_APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "expired",
  "executed",
] as const;
export const TOOL_EXECUTION_STATUSES = ["succeeded", "failed"] as const;

export type ToolRiskLevel = (typeof TOOL_RISK_LEVELS)[number];
export type ToolApprovalStatus = (typeof TOOL_APPROVAL_STATUSES)[number];
export type ToolExecutionStatus = (typeof TOOL_EXECUTION_STATUSES)[number];

export const toolPolicies = sqliteTable(
  "tool_policies",
  {
    toolName: text("tool_name").primaryKey(),
    riskLevel: text("risk_level", { enum: TOOL_RISK_LEVELS }).$type<ToolRiskLevel>().notNull(),
    requiresConfirmation: integer("requires_confirmation", { mode: "boolean" }).notNull().default(true),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    toolNameLengthCheck: check(
      "tool_policies_tool_name_length_check",
      sql`length(${table.toolName}) >= 1`,
    ),
  }),
);

export const toolApprovalRequests = sqliteTable(
  "tool_approval_requests",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    toolName: text("tool_name").notNull(),
    riskLevel: text("risk_level", { enum: TOOL_RISK_LEVELS }).$type<ToolRiskLevel>().notNull(),
    requestPayload: text("request_payload").notNull(),
    status: text("status", { enum: TOOL_APPROVAL_STATUSES }).$type<ToolApprovalStatus>().notNull(),
    reason: text("reason"),
    requestedAt: integer("requested_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    executedAt: integer("executed_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    projectStatusIdx: index("tool_approval_requests_project_status_idx").on(table.projectId, table.status),
    requestedAtIdx: index("tool_approval_requests_requested_at_idx").on(table.requestedAt),
    toolNameIdx: index("tool_approval_requests_tool_name_idx").on(table.toolName),
  }),
);

export const toolExecutionLogs = sqliteTable(
  "tool_execution_logs",
  {
    id: text("id").primaryKey(),
    approvalId: text("approval_id"),
    toolName: text("tool_name").notNull(),
    inputPayload: text("input_payload").notNull(),
    outputPayload: text("output_payload"),
    execStatus: text("exec_status", { enum: TOOL_EXECUTION_STATUSES }).$type<ToolExecutionStatus>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    approvalIdIdx: index("tool_execution_logs_approval_id_idx").on(table.approvalId),
    createdAtIdx: index("tool_execution_logs_created_at_idx").on(table.createdAt),
  }),
);

export type ToolPolicyRow = typeof toolPolicies.$inferSelect;
export type NewToolPolicyRow = typeof toolPolicies.$inferInsert;
export type ToolApprovalRequestRow = typeof toolApprovalRequests.$inferSelect;
export type NewToolApprovalRequestRow = typeof toolApprovalRequests.$inferInsert;
export type ToolExecutionLogRow = typeof toolExecutionLogs.$inferSelect;
export type NewToolExecutionLogRow = typeof toolExecutionLogs.$inferInsert;
