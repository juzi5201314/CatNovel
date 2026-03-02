import { and, asc, desc, eq } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import {
  chapters,
  entities,
  entityAliases,
  eventEntities,
  events,
  projectSnapshots,
  projects,
  type ProjectMode,
  type ProjectSnapshotTriggerType,
  type TimelineEntityType,
  type TimelineEventStatus,
} from "@/db/schema";

import { BaseRepository } from "./base-repository";

const SNAPSHOT_PAYLOAD_VERSION = 1 as const;
const INSERT_BATCH_SIZE = 200;
const TIMELINE_LOW_CONFIDENCE_THRESHOLD = 0.6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value;
}

function asString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  return value;
}

function asNullableString(value: unknown, fieldName: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string or null`);
  }
  return value;
}

function asNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`);
  }
  return value;
}

function asBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean`);
  }
  return value;
}

function asStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  return value.map((item, index) => asString(item, `${fieldName}[${index}]`));
}

function chunkItems<T>(items: T[], size = INSERT_BATCH_SIZE): T[][] {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toTimestampMs(date: Date): number {
  return date.getTime();
}

function fromTimestampMs(timestampMs: number): Date {
  return new Date(timestampMs);
}

export type SnapshotChapterPayload = {
  id: string;
  orderNo: number;
  title: string;
  content: string;
  summary: string | null;
  createdAtMs: number;
  updatedAtMs: number;
};

export type SnapshotAliasPayload = {
  id: string;
  alias: string;
  normalizedAlias: string;
  isPrimary: boolean;
  createdAtMs: number;
  updatedAtMs: number;
};

export type SnapshotEntityPayload = {
  id: string;
  name: string;
  normalizedName: string;
  type: TimelineEntityType;
  description: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  aliases: SnapshotAliasPayload[];
};

export type SnapshotEventPayload = {
  id: string;
  chapterId: string;
  chapterOrder: number;
  sequenceNo: number;
  title: string;
  summary: string | null;
  evidence: string | null;
  confidence: number;
  status: TimelineEventStatus;
  version: number;
  dedupeKey: string;
  entityIds: string[];
  createdAtMs: number;
  updatedAtMs: number;
};

export type SnapshotTimelinePayload = {
  summary: string;
  entityCount: number;
  eventCount: number;
  pendingReviewCount: number;
  lowConfidenceCount: number;
  entities: SnapshotEntityPayload[];
  events: SnapshotEventPayload[];
};

export type ProjectSnapshotPayload = {
  version: typeof SNAPSHOT_PAYLOAD_VERSION;
  capturedAt: string;
  project: {
    id: string;
    name: string;
    mode: ProjectMode;
  };
  chapters: SnapshotChapterPayload[];
  timeline: SnapshotTimelinePayload;
};

export type ProjectSnapshotRecord = {
  id: string;
  projectId: string;
  sourceChapterId: string | null;
  sourceSnapshotId: string | null;
  triggerType: ProjectSnapshotTriggerType;
  triggerReason: string;
  chapterCount: number;
  timelineEventCount: number;
  timelineSummary: string;
  payload: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectSnapshotParsedRecord = {
  snapshot: ProjectSnapshotRecord;
  payload: ProjectSnapshotPayload;
};

export type CreateProjectSnapshotInput = {
  projectId: string;
  triggerType: ProjectSnapshotTriggerType;
  triggerReason: string;
  sourceChapterId?: string | null;
  sourceSnapshotId?: string | null;
  id?: string;
};

export type AutoSnapshotPolicyInput = {
  projectId: string;
  chapterId: string;
  chapterTitle: string;
  chapterContent: string;
  chapterSummary: string | null;
  intervalMs: number;
  milestoneChars: number;
  now?: Date;
};

export type AutoSnapshotDecision = {
  shouldCreate: boolean;
  reason: string;
  elapsedMs: number | null;
  deltaChars: number;
};

export type RestoreProjectStateResult = {
  restoredChapterCount: number;
  restoredEntityCount: number;
  restoredEventCount: number;
  restoredEventEntityCount: number;
};

function buildTimelineSummary(
  timelineEntities: SnapshotEntityPayload[],
  timelineEvents: SnapshotEventPayload[],
): string {
  const statusStats: Record<TimelineEventStatus, number> = {
    auto: 0,
    confirmed: 0,
    rejected: 0,
    pending_review: 0,
  };

  for (const timelineEvent of timelineEvents) {
    statusStats[timelineEvent.status] += 1;
  }

  const lowConfidenceCount = timelineEvents.filter(
    (timelineEvent) => timelineEvent.confidence < TIMELINE_LOW_CONFIDENCE_THRESHOLD,
  ).length;
  const pendingReviewCount = statusStats.pending_review;
  const entityNameMap = new Map<string, string>(
    timelineEntities.map((timelineEntity) => [timelineEntity.id, timelineEntity.name]),
  );
  const latestEvents = timelineEvents.slice(-5);

  const lines = [
    `实体数: ${timelineEntities.length}`,
    `事件数: ${timelineEvents.length}`,
    `待审核事件: ${pendingReviewCount}`,
    `低置信度事件(<${TIMELINE_LOW_CONFIDENCE_THRESHOLD}): ${lowConfidenceCount}`,
    `状态分布: auto=${statusStats.auto}, confirmed=${statusStats.confirmed}, rejected=${statusStats.rejected}, pending_review=${statusStats.pending_review}`,
    "最近事件:",
  ];

  if (latestEvents.length === 0) {
    lines.push("- (无)");
  } else {
    for (const timelineEvent of latestEvents) {
      const entityNames = timelineEvent.entityIds
        .map((entityId) => entityNameMap.get(entityId))
        .filter((name): name is string => typeof name === "string");

      lines.push(
        `- 第${timelineEvent.chapterOrder}章#${timelineEvent.sequenceNo} ${timelineEvent.title} [${timelineEvent.status}] (${entityNames.join("、") || "无实体"})`,
      );
    }
  }

  return lines.join("\n");
}

export function parseProjectSnapshotPayload(rawPayload: string): ProjectSnapshotPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new Error("snapshot payload must be valid JSON");
  }

  if (!isRecord(parsed)) {
    throw new Error("snapshot payload must be an object");
  }
  if (parsed.version !== SNAPSHOT_PAYLOAD_VERSION) {
    throw new Error(`unsupported snapshot payload version: ${String(parsed.version)}`);
  }

  const projectRecord = parsed.project;
  const chaptersRaw = parsed.chapters;
  const timelineRecord = parsed.timeline;
  if (!isRecord(projectRecord)) {
    throw new Error("snapshot payload project is invalid");
  }
  if (!Array.isArray(chaptersRaw)) {
    throw new Error("snapshot payload chapters must be an array");
  }
  if (!isRecord(timelineRecord)) {
    throw new Error("snapshot payload timeline is invalid");
  }

  const chaptersPayload: SnapshotChapterPayload[] = chaptersRaw.map((chapterRaw, chapterIndex) => {
    if (!isRecord(chapterRaw)) {
      throw new Error(`snapshot chapter[${chapterIndex}] is invalid`);
    }

    return {
      id: asNonEmptyString(chapterRaw.id, `chapters[${chapterIndex}].id`),
      orderNo: asNumber(chapterRaw.orderNo, `chapters[${chapterIndex}].orderNo`),
      title: asString(chapterRaw.title, `chapters[${chapterIndex}].title`),
      content: asString(chapterRaw.content, `chapters[${chapterIndex}].content`),
      summary: asNullableString(chapterRaw.summary, `chapters[${chapterIndex}].summary`),
      createdAtMs: asNumber(chapterRaw.createdAtMs, `chapters[${chapterIndex}].createdAtMs`),
      updatedAtMs: asNumber(chapterRaw.updatedAtMs, `chapters[${chapterIndex}].updatedAtMs`),
    };
  });

  const timelineEntitiesRaw = timelineRecord.entities;
  const timelineEventsRaw = timelineRecord.events;
  if (!Array.isArray(timelineEntitiesRaw)) {
    throw new Error("snapshot payload timeline.entities must be an array");
  }
  if (!Array.isArray(timelineEventsRaw)) {
    throw new Error("snapshot payload timeline.events must be an array");
  }

  const timelineEntitiesPayload: SnapshotEntityPayload[] = timelineEntitiesRaw.map(
    (entityRaw, entityIndex) => {
      if (!isRecord(entityRaw)) {
        throw new Error(`timeline.entities[${entityIndex}] is invalid`);
      }
      if (!Array.isArray(entityRaw.aliases)) {
        throw new Error(`timeline.entities[${entityIndex}].aliases must be an array`);
      }

      const aliases = entityRaw.aliases.map((aliasRaw, aliasIndex) => {
        if (!isRecord(aliasRaw)) {
          throw new Error(`timeline.entities[${entityIndex}].aliases[${aliasIndex}] is invalid`);
        }
        return {
          id: asNonEmptyString(
            aliasRaw.id,
            `timeline.entities[${entityIndex}].aliases[${aliasIndex}].id`,
          ),
          alias: asString(aliasRaw.alias, `timeline.entities[${entityIndex}].aliases[${aliasIndex}].alias`),
          normalizedAlias: asString(
            aliasRaw.normalizedAlias,
            `timeline.entities[${entityIndex}].aliases[${aliasIndex}].normalizedAlias`,
          ),
          isPrimary: asBoolean(
            aliasRaw.isPrimary,
            `timeline.entities[${entityIndex}].aliases[${aliasIndex}].isPrimary`,
          ),
          createdAtMs: asNumber(
            aliasRaw.createdAtMs,
            `timeline.entities[${entityIndex}].aliases[${aliasIndex}].createdAtMs`,
          ),
          updatedAtMs: asNumber(
            aliasRaw.updatedAtMs,
            `timeline.entities[${entityIndex}].aliases[${aliasIndex}].updatedAtMs`,
          ),
        };
      });

      return {
        id: asNonEmptyString(entityRaw.id, `timeline.entities[${entityIndex}].id`),
        name: asString(entityRaw.name, `timeline.entities[${entityIndex}].name`),
        normalizedName: asString(
          entityRaw.normalizedName,
          `timeline.entities[${entityIndex}].normalizedName`,
        ),
        type: asString(entityRaw.type, `timeline.entities[${entityIndex}].type`) as TimelineEntityType,
        description: asNullableString(
          entityRaw.description,
          `timeline.entities[${entityIndex}].description`,
        ),
        createdAtMs: asNumber(entityRaw.createdAtMs, `timeline.entities[${entityIndex}].createdAtMs`),
        updatedAtMs: asNumber(entityRaw.updatedAtMs, `timeline.entities[${entityIndex}].updatedAtMs`),
        aliases,
      };
    },
  );

  const timelineEventsPayload: SnapshotEventPayload[] = timelineEventsRaw.map((eventRaw, eventIndex) => {
    if (!isRecord(eventRaw)) {
      throw new Error(`timeline.events[${eventIndex}] is invalid`);
    }

    return {
      id: asNonEmptyString(eventRaw.id, `timeline.events[${eventIndex}].id`),
      chapterId: asNonEmptyString(eventRaw.chapterId, `timeline.events[${eventIndex}].chapterId`),
      chapterOrder: asNumber(eventRaw.chapterOrder, `timeline.events[${eventIndex}].chapterOrder`),
      sequenceNo: asNumber(eventRaw.sequenceNo, `timeline.events[${eventIndex}].sequenceNo`),
      title: asString(eventRaw.title, `timeline.events[${eventIndex}].title`),
      summary: asNullableString(eventRaw.summary, `timeline.events[${eventIndex}].summary`),
      evidence: asNullableString(eventRaw.evidence, `timeline.events[${eventIndex}].evidence`),
      confidence: asNumber(eventRaw.confidence, `timeline.events[${eventIndex}].confidence`),
      status: asString(eventRaw.status, `timeline.events[${eventIndex}].status`) as TimelineEventStatus,
      version: asNumber(eventRaw.version, `timeline.events[${eventIndex}].version`),
      dedupeKey: asString(eventRaw.dedupeKey, `timeline.events[${eventIndex}].dedupeKey`),
      entityIds: asStringArray(eventRaw.entityIds, `timeline.events[${eventIndex}].entityIds`),
      createdAtMs: asNumber(eventRaw.createdAtMs, `timeline.events[${eventIndex}].createdAtMs`),
      updatedAtMs: asNumber(eventRaw.updatedAtMs, `timeline.events[${eventIndex}].updatedAtMs`),
    };
  });

  return {
    version: SNAPSHOT_PAYLOAD_VERSION,
    capturedAt: asString(parsed.capturedAt, "capturedAt"),
    project: {
      id: asNonEmptyString(projectRecord.id, "project.id"),
      name: asString(projectRecord.name, "project.name"),
      mode: asString(projectRecord.mode, "project.mode") as ProjectMode,
    },
    chapters: chaptersPayload,
    timeline: {
      summary: asString(timelineRecord.summary, "timeline.summary"),
      entityCount: asNumber(timelineRecord.entityCount, "timeline.entityCount"),
      eventCount: asNumber(timelineRecord.eventCount, "timeline.eventCount"),
      pendingReviewCount: asNumber(timelineRecord.pendingReviewCount, "timeline.pendingReviewCount"),
      lowConfidenceCount: asNumber(timelineRecord.lowConfidenceCount, "timeline.lowConfidenceCount"),
      entities: timelineEntitiesPayload,
      events: timelineEventsPayload,
    },
  };
}

export class ProjectSnapshotsRepository extends BaseRepository {
  constructor(database?: AppDatabase) {
    super(database);
  }

  listByProject(projectId: string, limit = 20): ProjectSnapshotRecord[] {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    return this.db
      .select()
      .from(projectSnapshots)
      .where(eq(projectSnapshots.projectId, projectId))
      .orderBy(desc(projectSnapshots.createdAt), desc(projectSnapshots.id))
      .limit(safeLimit)
      .all();
  }

  findById(projectId: string, snapshotId: string): ProjectSnapshotRecord | null {
    const row = this.db
      .select()
      .from(projectSnapshots)
      .where(and(eq(projectSnapshots.projectId, projectId), eq(projectSnapshots.id, snapshotId)))
      .get();
    return row ?? null;
  }

  findWithPayload(projectId: string, snapshotId: string): ProjectSnapshotParsedRecord | null {
    const snapshot = this.findById(projectId, snapshotId);
    if (!snapshot) {
      return null;
    }

    return {
      snapshot,
      payload: parseProjectSnapshotPayload(snapshot.payload),
    };
  }

  findLatestByProject(projectId: string): ProjectSnapshotRecord | null {
    const row = this.db
      .select()
      .from(projectSnapshots)
      .where(eq(projectSnapshots.projectId, projectId))
      .orderBy(desc(projectSnapshots.createdAt), desc(projectSnapshots.id))
      .limit(1)
      .get();
    return row ?? null;
  }

  findPreviousBySnapshot(projectId: string, snapshotId: string): ProjectSnapshotRecord | null {
    const rows = this.db
      .select()
      .from(projectSnapshots)
      .where(eq(projectSnapshots.projectId, projectId))
      .orderBy(desc(projectSnapshots.createdAt), desc(projectSnapshots.id))
      .all();
    if (rows.length === 0) {
      return null;
    }

    const currentIndex = rows.findIndex((row) => row.id === snapshotId);
    if (currentIndex === -1) {
      return null;
    }
    if (currentIndex < rows.length - 1) {
      return rows[currentIndex + 1] ?? null;
    }
    return null;
  }

  evaluateAutoSnapshotPolicy(input: AutoSnapshotPolicyInput): AutoSnapshotDecision {
    const now = input.now ?? new Date();
    const latestSnapshot = this.findLatestByProject(input.projectId);
    if (!latestSnapshot) {
      return {
        shouldCreate: true,
        reason: "auto_initial_snapshot",
        elapsedMs: null,
        deltaChars: input.chapterContent.length,
      };
    }

    const elapsedMs = Math.max(now.getTime() - latestSnapshot.createdAt.getTime(), 0);
    let baselineTitle = "";
    let baselineContent = "";
    let baselineSummary = "";

    try {
      const payload = parseProjectSnapshotPayload(latestSnapshot.payload);
      const baselineChapter = payload.chapters.find((chapter) => chapter.id === input.chapterId);
      if (!baselineChapter) {
        return {
          shouldCreate: true,
          reason: "auto_milestone_new_chapter",
          elapsedMs,
          deltaChars: input.chapterContent.length,
        };
      }

      baselineTitle = baselineChapter.title;
      baselineContent = baselineChapter.content;
      baselineSummary = baselineChapter.summary ?? "";
    } catch {
      // payload 无法解析时直接重建一次，避免后续策略漂移。
      return {
        shouldCreate: true,
        reason: "auto_repair_invalid_payload",
        elapsedMs,
        deltaChars: input.chapterContent.length,
      };
    }

    const currentSnapshotText = [input.chapterTitle, input.chapterContent, input.chapterSummary ?? ""].join("\n");
    const baselineSnapshotText = [baselineTitle, baselineContent, baselineSummary].join("\n");
    const deltaChars = Math.abs(currentSnapshotText.length - baselineSnapshotText.length);

    const intervalReached = elapsedMs >= input.intervalMs;
    const milestoneReached = deltaChars >= input.milestoneChars;

    if (intervalReached && milestoneReached) {
      return {
        shouldCreate: true,
        reason: "auto_interval_and_milestone",
        elapsedMs,
        deltaChars,
      };
    }
    if (intervalReached) {
      return {
        shouldCreate: true,
        reason: "auto_interval",
        elapsedMs,
        deltaChars,
      };
    }
    if (milestoneReached) {
      return {
        shouldCreate: true,
        reason: "auto_milestone",
        elapsedMs,
        deltaChars,
      };
    }

    return {
      shouldCreate: false,
      reason: "auto_skip",
      elapsedMs,
      deltaChars,
    };
  }

  createFromCurrentState(input: CreateProjectSnapshotInput): ProjectSnapshotRecord {
    const snapshotId = input.id ?? crypto.randomUUID();
    const projectState = this.collectProjectState(input.projectId);

    this.db
      .insert(projectSnapshots)
      .values({
        id: snapshotId,
        projectId: input.projectId,
        sourceChapterId: input.sourceChapterId ?? null,
        sourceSnapshotId: input.sourceSnapshotId ?? null,
        triggerType: input.triggerType,
        triggerReason: input.triggerReason,
        chapterCount: projectState.chapters.length,
        timelineEventCount: projectState.timeline.events.length,
        timelineSummary: projectState.timeline.summary,
        payload: JSON.stringify(projectState),
      })
      .run();

    const created = this.findById(input.projectId, snapshotId);
    if (!created) {
      throw new Error("failed to create project snapshot");
    }
    return created;
  }

  restoreProjectState(projectId: string, payload: ProjectSnapshotPayload): RestoreProjectStateResult {
    if (payload.project.id !== projectId) {
      throw new Error("snapshot projectId mismatch");
    }

    const snapshotChapterIdSet = new Set(payload.chapters.map((chapter) => chapter.id));
    const snapshotEntityIdSet = new Set(payload.timeline.entities.map((timelineEntity) => timelineEntity.id));
    const safeEvents = payload.timeline.events.filter((timelineEvent) =>
      snapshotChapterIdSet.has(timelineEvent.chapterId),
    );

    // 先清空旧状态再重建，确保恢复结果可预测且不残留脏数据。
    this.db.delete(events).where(eq(events.projectId, projectId)).run();
    this.db.delete(entityAliases).where(eq(entityAliases.projectId, projectId)).run();
    this.db.delete(entities).where(eq(entities.projectId, projectId)).run();
    this.db.delete(chapters).where(eq(chapters.projectId, projectId)).run();

    const chapterValues = payload.chapters
      .slice()
      .sort((left, right) => left.orderNo - right.orderNo)
      .map((chapter) => ({
        id: chapter.id,
        projectId,
        title: chapter.title,
        content: chapter.content,
        summary: chapter.summary,
        orderNo: chapter.orderNo,
        createdAt: fromTimestampMs(chapter.createdAtMs),
        updatedAt: fromTimestampMs(chapter.updatedAtMs),
      }));

    for (const chapterChunk of chunkItems(chapterValues)) {
      this.db.insert(chapters).values(chapterChunk).run();
    }

    const entityValues = payload.timeline.entities.map((timelineEntity) => ({
      id: timelineEntity.id,
      projectId,
      name: timelineEntity.name,
      normalizedName: timelineEntity.normalizedName,
      type: timelineEntity.type,
      description: timelineEntity.description,
      createdAt: fromTimestampMs(timelineEntity.createdAtMs),
      updatedAt: fromTimestampMs(timelineEntity.updatedAtMs),
    }));

    for (const entityChunk of chunkItems(entityValues)) {
      this.db.insert(entities).values(entityChunk).run();
    }

    const aliasValues = payload.timeline.entities.flatMap((timelineEntity) =>
      timelineEntity.aliases.map((alias) => ({
        id: alias.id,
        projectId,
        entityId: timelineEntity.id,
        alias: alias.alias,
        normalizedAlias: alias.normalizedAlias,
        isPrimary: alias.isPrimary,
        createdAt: fromTimestampMs(alias.createdAtMs),
        updatedAt: fromTimestampMs(alias.updatedAtMs),
      })),
    );

    for (const aliasChunk of chunkItems(aliasValues)) {
      this.db.insert(entityAliases).values(aliasChunk).run();
    }

    const eventValues = safeEvents.map((timelineEvent) => ({
      id: timelineEvent.id,
      projectId,
      chapterId: timelineEvent.chapterId,
      chapterOrder: timelineEvent.chapterOrder,
      sequenceNo: timelineEvent.sequenceNo,
      title: timelineEvent.title,
      summary: timelineEvent.summary,
      evidence: timelineEvent.evidence,
      confidence: timelineEvent.confidence,
      status: timelineEvent.status,
      version: timelineEvent.version,
      dedupeKey: timelineEvent.dedupeKey,
      createdAt: fromTimestampMs(timelineEvent.createdAtMs),
      updatedAt: fromTimestampMs(timelineEvent.updatedAtMs),
    }));

    for (const eventChunk of chunkItems(eventValues)) {
      this.db.insert(events).values(eventChunk).run();
    }

    const eventEntityValues = safeEvents.flatMap((timelineEvent) =>
      [...new Set(timelineEvent.entityIds)]
        .filter((entityId) => snapshotEntityIdSet.has(entityId))
        .map((entityId) => ({
          eventId: timelineEvent.id,
          entityId,
          role: "subject",
          createdAt: fromTimestampMs(timelineEvent.createdAtMs),
          updatedAt: fromTimestampMs(timelineEvent.updatedAtMs),
        })),
    );

    for (const eventEntityChunk of chunkItems(eventEntityValues)) {
      this.db.insert(eventEntities).values(eventEntityChunk).run();
    }

    return {
      restoredChapterCount: chapterValues.length,
      restoredEntityCount: entityValues.length,
      restoredEventCount: eventValues.length,
      restoredEventEntityCount: eventEntityValues.length,
    };
  }

  private collectProjectState(projectId: string): ProjectSnapshotPayload {
    const project = this.db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) {
      throw new Error("project not found");
    }

    const chapterRows = this.db
      .select()
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(asc(chapters.orderNo), asc(chapters.createdAt))
      .all();

    const entityRows = this.db
      .select()
      .from(entities)
      .where(eq(entities.projectId, projectId))
      .orderBy(asc(entities.createdAt))
      .all();

    const aliasRows = this.db
      .select()
      .from(entityAliases)
      .where(eq(entityAliases.projectId, projectId))
      .orderBy(desc(entityAliases.isPrimary), asc(entityAliases.alias), asc(entityAliases.createdAt))
      .all();

    const eventRows = this.db
      .select()
      .from(events)
      .where(eq(events.projectId, projectId))
      .orderBy(asc(events.chapterOrder), asc(events.sequenceNo), asc(events.createdAt))
      .all();

    const eventEntityRows = this.db
      .select({
        eventId: eventEntities.eventId,
        entityId: eventEntities.entityId,
      })
      .from(eventEntities)
      .innerJoin(events, eq(eventEntities.eventId, events.id))
      .where(eq(events.projectId, projectId))
      .orderBy(asc(eventEntities.eventId), asc(eventEntities.entityId))
      .all();

    const aliasesByEntityId = new Map<string, SnapshotAliasPayload[]>();
    for (const aliasRow of aliasRows) {
      const list = aliasesByEntityId.get(aliasRow.entityId) ?? [];
      list.push({
        id: aliasRow.id,
        alias: aliasRow.alias,
        normalizedAlias: aliasRow.normalizedAlias,
        isPrimary: aliasRow.isPrimary,
        createdAtMs: toTimestampMs(aliasRow.createdAt),
        updatedAtMs: toTimestampMs(aliasRow.updatedAt),
      });
      aliasesByEntityId.set(aliasRow.entityId, list);
    }

    const entityIdsByEventId = new Map<string, string[]>();
    for (const eventEntityRow of eventEntityRows) {
      const list = entityIdsByEventId.get(eventEntityRow.eventId) ?? [];
      list.push(eventEntityRow.entityId);
      entityIdsByEventId.set(eventEntityRow.eventId, list);
    }

    const snapshotChapters: SnapshotChapterPayload[] = chapterRows.map((chapterRow) => ({
      id: chapterRow.id,
      orderNo: chapterRow.orderNo,
      title: chapterRow.title,
      content: chapterRow.content,
      summary: chapterRow.summary,
      createdAtMs: toTimestampMs(chapterRow.createdAt),
      updatedAtMs: toTimestampMs(chapterRow.updatedAt),
    }));

    const snapshotEntities: SnapshotEntityPayload[] = entityRows.map((entityRow) => ({
      id: entityRow.id,
      name: entityRow.name,
      normalizedName: entityRow.normalizedName,
      type: entityRow.type,
      description: entityRow.description,
      createdAtMs: toTimestampMs(entityRow.createdAt),
      updatedAtMs: toTimestampMs(entityRow.updatedAt),
      aliases: aliasesByEntityId.get(entityRow.id) ?? [],
    }));

    const snapshotEvents: SnapshotEventPayload[] = eventRows.map((eventRow) => ({
      id: eventRow.id,
      chapterId: eventRow.chapterId,
      chapterOrder: eventRow.chapterOrder,
      sequenceNo: eventRow.sequenceNo,
      title: eventRow.title,
      summary: eventRow.summary,
      evidence: eventRow.evidence,
      confidence: eventRow.confidence,
      status: eventRow.status,
      version: eventRow.version,
      dedupeKey: eventRow.dedupeKey,
      entityIds: entityIdsByEventId.get(eventRow.id) ?? [],
      createdAtMs: toTimestampMs(eventRow.createdAt),
      updatedAtMs: toTimestampMs(eventRow.updatedAt),
    }));

    const lowConfidenceCount = snapshotEvents.filter(
      (timelineEvent) => timelineEvent.confidence < TIMELINE_LOW_CONFIDENCE_THRESHOLD,
    ).length;
    const pendingReviewCount = snapshotEvents.filter(
      (timelineEvent) => timelineEvent.status === "pending_review",
    ).length;
    const timelineSummary = buildTimelineSummary(snapshotEntities, snapshotEvents);

    return {
      version: SNAPSHOT_PAYLOAD_VERSION,
      capturedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        mode: project.mode,
      },
      chapters: snapshotChapters,
      timeline: {
        summary: timelineSummary,
        entityCount: snapshotEntities.length,
        eventCount: snapshotEvents.length,
        pendingReviewCount,
        lowConfidenceCount,
        entities: snapshotEntities,
        events: snapshotEvents,
      },
    };
  }
}
