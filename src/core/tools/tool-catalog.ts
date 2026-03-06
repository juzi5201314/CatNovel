import type { ToolRiskLevel } from "@/db/schema";

export type ToolParameterSchema = {
  type: "object";
  additionalProperties: boolean;
  properties?: Record<string, unknown>;
  required?: string[];
};

export type ToolCatalogItem = {
  toolName: string;
  riskLevel: ToolRiskLevel;
  description: string;
  parameters: ToolParameterSchema;
};

const STRING = { type: "string" } as const;
const INTEGER = { type: "integer" } as const;
const NUMBER = { type: "number" } as const;
const BOOLEAN = { type: "boolean" } as const;

function stringEnum(values: string[]) {
  return {
    type: "string",
    enum: values,
  } as const;
}

function stringArray() {
  return {
    type: "array",
    items: STRING,
  } as const;
}

function objectSchema(
  properties: Record<string, unknown> = {},
  required: string[] = [],
  additionalProperties = true,
): ToolParameterSchema {
  return {
    type: "object",
    additionalProperties,
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

const TOOL_CATALOG: ToolCatalogItem[] = [
  {
    toolName: "system.listTools",
    riskLevel: "read",
    description: "列出当前可用内置工具与风险级别。",
    parameters: objectSchema({}, [], false),
  },
  {
    toolName: "chapter.list",
    riskLevel: "read",
    description: "获取项目章节列表。",
    parameters: objectSchema({
      includeSummary: BOOLEAN,
      includeContent: BOOLEAN,
      projectId: STRING,
    }),
  },
  {
    toolName: "chapter.get",
    riskLevel: "read",
    description: "获取单章基础信息。",
    parameters: objectSchema({ chapterId: STRING }, ["chapterId"]),
  },
  {
    toolName: "chapter.getContent",
    riskLevel: "read",
    description: "获取单章正文与摘要。",
    parameters: objectSchema({ chapterId: STRING }, ["chapterId"]),
  },
  {
    toolName: "chapter.search",
    riskLevel: "read",
    description: "按关键词检索章节内容片段。",
    parameters: objectSchema(
      {
        query: STRING,
        topK: INTEGER,
        chapterScope: objectSchema({ from: INTEGER, to: INTEGER }),
      },
      ["query"],
    ),
  },
  {
    toolName: "chapter.range",
    riskLevel: "read",
    description: "按章节范围批量读取章节。",
    parameters: objectSchema({
      chapterNos: stringArray(),
      from: INTEGER,
      to: INTEGER,
      includeSummary: BOOLEAN,
      includeContent: BOOLEAN,
    }),
  },
  {
    toolName: "project.getOverview",
    riskLevel: "read",
    description: "获取项目统计概览。",
    parameters: objectSchema({
      projectId: STRING,
    }),
  },
  {
    toolName: "timeline.getEntity",
    riskLevel: "read",
    description: "查询实体详情与时间线。",
    parameters: objectSchema({
      entityId: STRING,
      nameOrAlias: STRING,
    }),
  },
  {
    toolName: "timeline.listEvents",
    riskLevel: "read",
    description: "按项目或章节筛选时间线事件。",
    parameters: objectSchema({
      entityId: STRING,
      chapterId: STRING,
      status: stringEnum(["auto", "confirmed", "rejected", "pending_review"]),
      limit: INTEGER,
      projectId: STRING,
    }),
  },
  {
    toolName: "lore.listNodes",
    riskLevel: "read",
    description: "获取设定集树形节点列表，支持按关键词搜索。",
    parameters: objectSchema({
      query: STRING,
      limit: INTEGER,
    }),
  },
  {
    toolName: "lore.getNode",
    riskLevel: "read",
    description: "获取设定节点详情及其子节点。",
    parameters: objectSchema({
      nodeId: STRING,
      name: STRING,
    }),
  },
  {
    toolName: "lore.searchNodes",
    riskLevel: "read",
    description: "按关键词搜索设定节点名称和描述。",
    parameters: objectSchema(
      {
        query: STRING,
        limit: INTEGER,
      },
      ["query"],
    ),
  },
  {
    toolName: "lore.getRootDescriptions",
    riskLevel: "read",
    description: "获取一级设定节点的描述（世界观上下文）。",
    parameters: objectSchema({}, [], false),
  },
  {
    toolName: "rag.search",
    riskLevel: "read",
    description: "检索与问题相关的章节证据片段。",
    parameters: objectSchema(
      {
        query: STRING,
        topK: INTEGER,
        chapterScope: objectSchema({ from: INTEGER, to: INTEGER }),
      },
      ["query"],
    ),
  },
  {
    toolName: "rag.getEvidence",
    riskLevel: "read",
    description: "根据 chunkId/chapterId 拉取证据详情。",
    parameters: objectSchema({
      chunkIds: stringArray(),
      chapterIds: stringArray(),
      chapterId: STRING,
      maxChars: INTEGER,
    }),
  },
  {
    toolName: "snapshot.list",
    riskLevel: "read",
    description: "获取项目快照列表。",
    parameters: objectSchema({
      limit: INTEGER,
    }),
  },
  {
    toolName: "approval.listPending",
    riskLevel: "read",
    description: "获取待审批工具请求。",
    parameters: objectSchema({
      limit: INTEGER,
    }),
  },
  {
    toolName: "chapter.create",
    riskLevel: "write",
    description: "新建章节（需要审批）。",
    parameters: objectSchema(
      {
        title: STRING,
        content: STRING,
        summary: STRING,
        orderNo: INTEGER,
        id: STRING,
      },
      ["title"],
    ),
  },
  {
    toolName: "chapter.updateMeta",
    riskLevel: "write",
    description: "更新章节标题/摘要/序号（需要审批）。",
    parameters: objectSchema(
      {
        chapterId: STRING,
        title: STRING,
        summary: STRING,
        orderNo: INTEGER,
      },
      ["chapterId"],
    ),
  },
  {
    toolName: "chapter.updateContent",
    riskLevel: "write",
    description: "更新章节正文（需要审批）。",
    parameters: objectSchema(
      {
        chapterId: STRING,
        content: STRING,
        mode: stringEnum(["replace", "append", "prepend"]),
        summary: STRING,
      },
      ["chapterId", "content"],
    ),
  },
  {
    toolName: "chapter.reorder",
    riskLevel: "write",
    description: "重排章节顺序（需要审批）。",
    parameters: objectSchema({
      orderedChapterIds: stringArray(),
      items: {
        type: "array",
        items: objectSchema(
          {
            chapterId: STRING,
            orderNo: INTEGER,
          },
          ["chapterId", "orderNo"],
        ),
      },
    }),
  },
  {
    toolName: "chapter.delete",
    riskLevel: "high_risk",
    description: "删除章节（高风险，需要审批）。",
    parameters: objectSchema({ chapterId: STRING }, ["chapterId"]),
  },
  {
    toolName: "timeline.upsertEvent",
    riskLevel: "write",
    description: "新增或更新时间线事件（需要审批）。",
    parameters: objectSchema(
      {
        id: STRING,
        eventId: STRING,
        chapterId: STRING,
        chapterOrder: INTEGER,
        chapterNo: INTEGER,
        sequenceNo: INTEGER,
        title: STRING,
        summary: STRING,
        description: STRING,
        evidence: STRING,
        evidenceSnippet: STRING,
        confidence: NUMBER,
        status: stringEnum(["auto", "confirmed", "rejected", "pending_review"]),
        entityId: STRING,
        entityIds: stringArray(),
      },
      ["chapterId", "chapterOrder", "title"],
    ),
  },
  {
    toolName: "timeline.editEvent",
    riskLevel: "write",
    description: "编辑既有时间线事件（需要审批）。",
    parameters: objectSchema(
      {
        eventId: STRING,
        patch: objectSchema(),
      },
      ["eventId"],
    ),
  },
  {
    toolName: "timeline.resolveConflict",
    riskLevel: "write",
    description: "处理时间线冲突并更新状态（需要审批）。",
    parameters: objectSchema(
      {
        eventId: STRING,
        decision: stringEnum(["confirm", "reject", "queue", "auto"]),
        status: stringEnum(["auto", "confirmed", "rejected", "pending_review"]),
        reason: STRING,
        note: STRING,
        reviewedBy: STRING,
      },
      ["eventId"],
    ),
  },
  {
    toolName: "lore.upsertNode",
    riskLevel: "write",
    description: "新增或更新设定节点（需要审批）。",
    parameters: objectSchema(
      {
        nodeId: STRING,
        name: STRING,
        description: STRING,
        parentId: STRING,
      },
      ["name"],
    ),
  },
  {
    toolName: "lore.deleteNode",
    riskLevel: "write",
    description: "删除设定节点及其所有子节点（需要审批）。",
    parameters: objectSchema(
      {
        nodeId: STRING,
      },
      ["nodeId"],
    ),
  },
  {
    toolName: "rag.reindex",
    riskLevel: "write",
    description: "重建检索索引（需要审批）。",
    parameters: objectSchema({
      chapterIds: stringArray(),
      reason: stringEnum(["chapter_updated", "full_rebuild"]),
    }),
  },
  {
    toolName: "snapshot.create",
    riskLevel: "write",
    description: "创建项目快照（需要审批）。",
    parameters: objectSchema({
      reason: STRING,
    }),
  },
  {
    toolName: "snapshot.restore",
    riskLevel: "high_risk",
    description: "恢复到指定快照（高风险，需要审批）。",
    parameters: objectSchema({ snapshotId: STRING, reason: STRING }, ["snapshotId"]),
  },
  {
    toolName: "approval.approve",
    riskLevel: "write",
    description: "审批工具请求（需要审批）。",
    parameters: objectSchema({ approvalId: STRING, comment: STRING }, ["approvalId"]),
  },
  {
    toolName: "approval.reject",
    riskLevel: "write",
    description: "拒绝工具请求（需要审批）。",
    parameters: objectSchema({ approvalId: STRING, reason: STRING }, ["approvalId"]),
  },
  {
    toolName: "settings.providers.rotateKey",
    riskLevel: "high_risk",
    description: "轮换 Provider 密钥（高风险，需要审批）。",
    parameters: objectSchema(),
  },
  {
    toolName: "settings.providers.delete",
    riskLevel: "high_risk",
    description: "删除 Provider（高风险，需要审批）。",
    parameters: objectSchema(),
  },
  {
    toolName: "settings.modelPresets.deleteBuiltinLocked",
    riskLevel: "high_risk",
    description: "删除内置模型预设（高风险，需要审批）。",
    parameters: objectSchema(),
  },
];

const TOOL_NAME_TO_ALIAS = new Map<string, string>();
const TOOL_ALIAS_TO_NAME = new Map<string, string>();

function toToolAliasUnsafe(toolName: string): string {
  const alias = toolName
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return alias.length > 0 ? alias : "tool";
}

for (const item of TOOL_CATALOG) {
  const alias = toToolAliasUnsafe(item.toolName);
  const existed = TOOL_ALIAS_TO_NAME.get(alias);
  if (existed && existed !== item.toolName) {
    throw new Error(`tool alias collision: ${alias} => ${existed}, ${item.toolName}`);
  }
  TOOL_NAME_TO_ALIAS.set(item.toolName, alias);
  TOOL_ALIAS_TO_NAME.set(alias, item.toolName);
}

const TOOL_CATALOG_BY_NAME = new Map<string, ToolCatalogItem>(
  TOOL_CATALOG.map((item) => [item.toolName, item]),
);

export function listToolCatalog(): ToolCatalogItem[] {
  return [...TOOL_CATALOG];
}

export function getToolCatalogItem(toolName: string): ToolCatalogItem | undefined {
  return TOOL_CATALOG_BY_NAME.get(toolName);
}

export function getToolAliasByName(toolName: string): string | undefined {
  return TOOL_NAME_TO_ALIAS.get(toolName);
}

export function getToolNameByAlias(alias: string): string | undefined {
  return TOOL_ALIAS_TO_NAME.get(alias);
}

export function toToolAlias(toolName: string): string {
  return getToolAliasByName(toolName) ?? toToolAliasUnsafe(toolName);
}
