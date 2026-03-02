import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import {
  entities,
  entityAliases,
  eventEntities,
  events,
  timelineSnapshots,
  type EntityAliasRow,
  type TimelineEntityRow,
  type TimelineEntityType,
  type TimelineEventRow,
  type TimelineEventStatus,
} from "@/db/schema";

import { BaseRepository } from "./base-repository";

export const TIMELINE_CONFLICT_CODES = [
  "time_order_conflict",
  "duplicate_event",
  "entity_conflict",
] as const;

export type TimelineConflictCode = (typeof TIMELINE_CONFLICT_CODES)[number];

export type TimelineConflict = {
  code: TimelineConflictCode;
  message: string;
  eventId?: string;
  entityId?: string;
  relatedEventId?: string;
  alias?: string;
};

export type TimelineConflictResult = {
  hasConflicts: boolean;
  codes: TimelineConflictCode[];
  conflicts: TimelineConflict[];
};

export type NormalizeEntityInput = {
  entityId?: string;
  projectId: string;
  name: string;
  type?: TimelineEntityType;
  description?: string | null;
  aliases?: string[];
};

export type NormalizeEntityResult = {
  entity: TimelineEntityRow;
  aliases: EntityAliasRow[];
  conflictResult: TimelineConflictResult;
};

export type DetectTimelineConflictInput = {
  projectId: string;
  chapterId: string;
  chapterOrder: number;
  sequenceNo?: number;
  title: string;
  summary?: string | null;
  entityIds: string[];
  eventId?: string;
};

export type UpsertTimelineEventInput = DetectTimelineConflictInput & {
  id?: string;
  evidence?: string | null;
  confidence?: number;
  status?: TimelineEventStatus;
  entityRole?: string;
};

export type TimelineEventWithEntities = {
  event: TimelineEventRow;
  entityIds: string[];
};

export type UpsertTimelineEventResult = {
  event: TimelineEventRow;
  entityIds: string[];
  snapshotId: string;
  conflictResult: TimelineConflictResult;
};

export type DeleteChapterEventsResult = {
  deletedEventCount: number;
  deletedEventIds: string[];
  snapshotId: string;
};

export type EntityWithAliases = {
  entity: TimelineEntityRow;
  aliases: EntityAliasRow[];
};

type AliasCandidate = {
  alias: string;
  normalizedAlias: string;
  isPrimary: boolean;
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupeEntityIds(entityIds: string[]): string[] {
  return [...new Set(entityIds.map((entityId) => entityId.trim()).filter((entityId) => entityId.length > 0))];
}

function collectAliasCandidates(name: string, aliases: string[]): AliasCandidate[] {
  const source = [name, ...aliases];
  const candidateByNormalizedAlias = new Map<string, AliasCandidate>();

  for (const rawAlias of source) {
    const alias = rawAlias.trim();
    if (!alias) {
      continue;
    }

    const normalizedAlias = normalizeToken(alias);
    if (!normalizedAlias) {
      continue;
    }

    const existing = candidateByNormalizedAlias.get(normalizedAlias);
    const nextCandidate: AliasCandidate = {
      alias,
      normalizedAlias,
      isPrimary: normalizedAlias === normalizeToken(name),
    };

    if (!existing || nextCandidate.isPrimary) {
      candidateByNormalizedAlias.set(normalizedAlias, nextCandidate);
    }
  }

  return [...candidateByNormalizedAlias.values()];
}

function buildConflictResult(conflicts: TimelineConflict[]): TimelineConflictResult {
  return {
    hasConflicts: conflicts.length > 0,
    codes: [...new Set(conflicts.map((conflict) => conflict.code))],
    conflicts,
  };
}

function buildEventDedupeKey(input: {
  chapterId: string;
  title: string;
  summary?: string | null;
  entityIds: string[];
}): string {
  const normalizedTitle = normalizeToken(input.title);
  const normalizedSummary = input.summary ? normalizeToken(input.summary) : "";
  const sortedEntityIds = [...input.entityIds].sort();
  return [input.chapterId, normalizedTitle, normalizedSummary, sortedEntityIds.join(",")].join("|");
}

export class TimelineRepository extends BaseRepository {
  constructor(database?: AppDatabase) {
    super(database);
  }

  listEntitiesByProject(projectId: string): EntityWithAliases[] {
    const entityRows = this.db
      .select()
      .from(entities)
      .where(eq(entities.projectId, projectId))
      .orderBy(asc(entities.createdAt))
      .all();

    if (entityRows.length === 0) {
      return [];
    }

    const aliasRows = this.db
      .select()
      .from(entityAliases)
      .where(eq(entityAliases.projectId, projectId))
      .orderBy(desc(entityAliases.isPrimary), asc(entityAliases.alias))
      .all();

    const aliasMap = new Map<string, EntityAliasRow[]>();
    for (const aliasRow of aliasRows) {
      const rowList = aliasMap.get(aliasRow.entityId) ?? [];
      rowList.push(aliasRow);
      aliasMap.set(aliasRow.entityId, rowList);
    }

    return entityRows.map((entityRow) => ({
      entity: entityRow,
      aliases: aliasMap.get(entityRow.id) ?? [],
    }));
  }

  findEntityByNameOrAlias(projectId: string, rawNameOrAlias: string): TimelineEntityRow | null {
    const normalizedNameOrAlias = normalizeToken(rawNameOrAlias);
    if (!normalizedNameOrAlias) {
      return null;
    }

    const directEntity = this.db
      .select()
      .from(entities)
      .where(and(eq(entities.projectId, projectId), eq(entities.normalizedName, normalizedNameOrAlias)))
      .get();

    if (directEntity) {
      return directEntity;
    }

    const aliasRow = this.db
      .select()
      .from(entityAliases)
      .where(and(eq(entityAliases.projectId, projectId), eq(entityAliases.normalizedAlias, normalizedNameOrAlias)))
      .get();

    if (!aliasRow) {
      return null;
    }

    const entityRow = this.db
      .select()
      .from(entities)
      .where(and(eq(entities.projectId, projectId), eq(entities.id, aliasRow.entityId)))
      .get();
    return entityRow ?? null;
  }

  normalizeEntityAndAliases(input: NormalizeEntityInput): NormalizeEntityResult {
    const name = input.name.trim();
    if (!name) {
      throw new Error("entity name is required");
    }

    const normalizedName = normalizeToken(name);
    const aliasCandidates = collectAliasCandidates(name, input.aliases ?? []);

    return this.transaction((tx) => {
      const conflicts: TimelineConflict[] = [];
      let entityRow: TimelineEntityRow | null = null;

      if (input.entityId) {
        entityRow =
          tx
            .select()
            .from(entities)
            .where(and(eq(entities.projectId, input.projectId), eq(entities.id, input.entityId)))
            .get() ?? null;
      }

      if (!entityRow) {
        entityRow =
          tx
            .select()
            .from(entities)
            .where(and(eq(entities.projectId, input.projectId), eq(entities.normalizedName, normalizedName)))
            .get() ?? null;
      }

      if (!entityRow && aliasCandidates.length > 0) {
        const normalizedAliases = aliasCandidates.map((candidate) => candidate.normalizedAlias);
        const aliasMatches = tx
          .select()
          .from(entityAliases)
          .where(
            and(
              eq(entityAliases.projectId, input.projectId),
              inArray(entityAliases.normalizedAlias, normalizedAliases),
            ),
          )
          .all();

        const candidateEntityIds = [...new Set(aliasMatches.map((aliasMatch) => aliasMatch.entityId))];
        if (candidateEntityIds.length > 1) {
          conflicts.push({
            code: "entity_conflict",
            message: "aliases map to multiple entities",
          });
        }

        const firstCandidateEntityId = candidateEntityIds.at(0);
        if (firstCandidateEntityId) {
          entityRow =
            tx
              .select()
              .from(entities)
              .where(and(eq(entities.projectId, input.projectId), eq(entities.id, firstCandidateEntityId)))
              .get() ?? null;
        }
      }

      if (entityRow) {
        tx.update(entities)
          .set({
            name,
            normalizedName,
            type: input.type ?? entityRow.type,
            description: input.description ?? entityRow.description ?? null,
            updatedAt: new Date(),
          })
          .where(eq(entities.id, entityRow.id))
          .run();
      } else {
        const entityId = input.entityId ?? crypto.randomUUID();
        tx.insert(entities)
          .values({
            id: entityId,
            projectId: input.projectId,
            name,
            normalizedName,
            type: input.type ?? "other",
            description: input.description ?? null,
          })
          .run();
      }

      const persistedEntity =
        tx
          .select()
          .from(entities)
          .where(and(eq(entities.projectId, input.projectId), eq(entities.normalizedName, normalizedName)))
          .get() ?? null;
      if (!persistedEntity) {
        throw new Error("failed to normalize entity");
      }

      tx.update(entityAliases)
        .set({
          isPrimary: false,
          updatedAt: new Date(),
        })
        .where(eq(entityAliases.entityId, persistedEntity.id))
        .run();

      for (const candidate of aliasCandidates) {
        const existingAlias =
          tx
            .select()
            .from(entityAliases)
            .where(
              and(
                eq(entityAliases.projectId, input.projectId),
                eq(entityAliases.normalizedAlias, candidate.normalizedAlias),
              ),
            )
            .get() ?? null;

        if (existingAlias && existingAlias.entityId !== persistedEntity.id) {
          conflicts.push({
            code: "entity_conflict",
            message: "alias is already mapped to another entity",
            alias: candidate.alias,
            entityId: existingAlias.entityId,
          });
          continue;
        }

        if (existingAlias) {
          tx.update(entityAliases)
            .set({
              alias: candidate.alias,
              isPrimary: candidate.isPrimary,
              updatedAt: new Date(),
            })
            .where(eq(entityAliases.id, existingAlias.id))
            .run();
          continue;
        }

        tx.insert(entityAliases)
          .values({
            id: crypto.randomUUID(),
            projectId: input.projectId,
            entityId: persistedEntity.id,
            alias: candidate.alias,
            normalizedAlias: candidate.normalizedAlias,
            isPrimary: candidate.isPrimary,
          })
          .run();
      }

      const persistedAliases = tx
        .select()
        .from(entityAliases)
        .where(eq(entityAliases.entityId, persistedEntity.id))
        .orderBy(desc(entityAliases.isPrimary), asc(entityAliases.alias))
        .all();

      return {
        entity: persistedEntity,
        aliases: persistedAliases,
        conflictResult: buildConflictResult(conflicts),
      };
    });
  }

  detectConflicts(input: DetectTimelineConflictInput): TimelineConflictResult {
    return this.detectConflictsInDb(this.db, input);
  }

  upsertEventWithSnapshot(input: UpsertTimelineEventInput): UpsertTimelineEventResult {
    const title = input.title.trim();
    if (!title) {
      throw new Error("event title is required");
    }

    const sequenceNo = input.sequenceNo ?? 0;
    if (sequenceNo < 0) {
      throw new Error("sequenceNo must be non-negative");
    }

    const confidence = input.confidence ?? 0.5;
    if (confidence < 0 || confidence > 1) {
      throw new Error("confidence must be between 0 and 1");
    }

    return this.transaction((tx) => {
      // 先做结构化冲突检测，供上层按 code 决策。
      const conflictResult = this.detectConflictsInDb(tx, {
        projectId: input.projectId,
        chapterId: input.chapterId,
        chapterOrder: input.chapterOrder,
        sequenceNo,
        title,
        summary: input.summary ?? null,
        entityIds: input.entityIds,
        eventId: input.id,
      });

      const uniqueEntityIds = dedupeEntityIds(input.entityIds);
      const validEntityIds = this.filterValidEntityIds(tx, input.projectId, uniqueEntityIds);
      const dedupeKey = buildEventDedupeKey({
        chapterId: input.chapterId,
        title,
        summary: input.summary ?? null,
        entityIds: validEntityIds,
      });

      let existingEvent: TimelineEventRow | null = null;
      let eventId = input.id ?? crypto.randomUUID();

      if (input.id) {
        existingEvent =
          tx
            .select()
            .from(events)
            .where(and(eq(events.projectId, input.projectId), eq(events.id, input.id)))
            .get() ?? null;
      } else {
        existingEvent =
          tx
            .select()
            .from(events)
            .where(and(eq(events.projectId, input.projectId), eq(events.dedupeKey, dedupeKey)))
            .get() ?? null;
        if (existingEvent) {
          // 新事件命中 dedupe key 时，转为版本升级而不是重复插入。
          eventId = existingEvent.id;
        }
      }

      const previousEntityIds = existingEvent
        ? tx
            .select({ entityId: eventEntities.entityId })
            .from(eventEntities)
            .where(eq(eventEntities.eventId, eventId))
            .all()
            .map((row) => row.entityId)
        : [];

      const nextVersion = existingEvent ? existingEvent.version + 1 : 1;
      const nextStatus: TimelineEventStatus =
        input.status ?? (conflictResult.hasConflicts ? "pending_review" : "auto");

      if (existingEvent) {
        tx.update(events)
          .set({
            chapterId: input.chapterId,
            chapterOrder: input.chapterOrder,
            sequenceNo,
            title,
            summary: input.summary ?? null,
            evidence: input.evidence ?? null,
            confidence,
            status: nextStatus,
            version: nextVersion,
            dedupeKey,
            updatedAt: new Date(),
          })
          .where(eq(events.id, eventId))
          .run();
      } else {
        tx.insert(events)
          .values({
            id: eventId,
            projectId: input.projectId,
            chapterId: input.chapterId,
            chapterOrder: input.chapterOrder,
            sequenceNo,
            title,
            summary: input.summary ?? null,
            evidence: input.evidence ?? null,
            confidence,
            status: nextStatus,
            version: 1,
            dedupeKey,
          })
          .run();
      }

      tx.delete(eventEntities).where(eq(eventEntities.eventId, eventId)).run();
      if (validEntityIds.length > 0) {
        tx.insert(eventEntities)
          .values(
            validEntityIds.map((entityId) => ({
              eventId,
              entityId,
              role: input.entityRole ?? "subject",
            })),
          )
          .run();
      }

      const persistedEvent =
        tx
          .select()
          .from(events)
          .where(eq(events.id, eventId))
          .get() ?? null;
      if (!persistedEvent) {
        throw new Error("failed to persist timeline event");
      }

      const persistedEntityIds = tx
        .select({ entityId: eventEntities.entityId })
        .from(eventEntities)
        .where(eq(eventEntities.eventId, eventId))
        .all()
        .map((row) => row.entityId);

      const snapshotId = crypto.randomUUID();
      // 每次事件写入都落快照，确保后续可回溯差异。
      tx.insert(timelineSnapshots)
        .values({
          id: snapshotId,
          projectId: input.projectId,
          chapterId: input.chapterId,
          eventId,
          snapshotType: "event_upsert",
          eventVersion: persistedEvent.version,
          payload: JSON.stringify({
            operation: existingEvent ? "update" : "insert",
            previous: existingEvent
              ? {
                  eventId: existingEvent.id,
                  version: existingEvent.version,
                  entityIds: previousEntityIds,
                }
              : null,
            current: {
              eventId: persistedEvent.id,
              version: persistedEvent.version,
              status: persistedEvent.status,
              entityIds: persistedEntityIds,
            },
            conflictCodes: conflictResult.codes,
            conflicts: conflictResult.conflicts,
          }),
        })
        .run();

      return {
        event: persistedEvent,
        entityIds: persistedEntityIds,
        snapshotId,
        conflictResult,
      };
    });
  }

  getTimelineByEntity(projectId: string, entityId: string): TimelineEventWithEntities[] {
    const rows = this.db
      .select({ event: events })
      .from(events)
      .innerJoin(eventEntities, eq(events.id, eventEntities.eventId))
      .where(and(eq(events.projectId, projectId), eq(eventEntities.entityId, entityId)))
      .orderBy(asc(events.chapterOrder), asc(events.sequenceNo), asc(events.createdAt))
      .all();

    if (rows.length === 0) {
      return [];
    }

    const eventRows = rows.map((row) => row.event);
    const eventEntityMap = this.getEventEntityMap(this.db, eventRows.map((eventRow) => eventRow.id));
    return eventRows.map((eventRow) => ({
      event: eventRow,
      entityIds: eventEntityMap.get(eventRow.id) ?? [],
    }));
  }

  deleteByChapterForRebuild(projectId: string, chapterId: string): DeleteChapterEventsResult {
    return this.transaction((tx) => {
      const chapterEvents = tx
        .select()
        .from(events)
        .where(and(eq(events.projectId, projectId), eq(events.chapterId, chapterId)))
        .orderBy(asc(events.chapterOrder), asc(events.sequenceNo))
        .all();

      const deletedEventIds = chapterEvents.map((eventRow) => eventRow.id);
      const deletedEventCount = tx
        .delete(events)
        .where(and(eq(events.projectId, projectId), eq(events.chapterId, chapterId)))
        .run().changes;

      const snapshotId = crypto.randomUUID();
      tx.insert(timelineSnapshots)
        .values({
          id: snapshotId,
          projectId,
          chapterId,
          eventId: null,
          snapshotType: "chapter_rebuild",
          eventVersion: null,
          payload: JSON.stringify({
            operation: "delete_chapter_events_for_rebuild",
            chapterId,
            deletedEventCount,
            deletedEventIds,
          }),
        })
        .run();

      return {
        deletedEventCount,
        deletedEventIds,
        snapshotId,
      };
    });
  }

  private detectConflictsInDb(
    database: AppDatabase,
    input: DetectTimelineConflictInput,
  ): TimelineConflictResult {
    const conflicts: TimelineConflict[] = [];
    const entityIds = dedupeEntityIds(input.entityIds);

    if (entityIds.length !== input.entityIds.length) {
      conflicts.push({
        code: "entity_conflict",
        message: "duplicate entity IDs in event payload",
      });
    }

    if (entityIds.length > 0) {
      const existingEntityRows = database
        .select({ id: entities.id })
        .from(entities)
        .where(and(eq(entities.projectId, input.projectId), inArray(entities.id, entityIds)))
        .all();
      const existingEntityIdSet = new Set(existingEntityRows.map((row) => row.id));
      const missingEntityIds = entityIds.filter((entityId) => !existingEntityIdSet.has(entityId));
      if (missingEntityIds.length > 0) {
        conflicts.push({
          code: "entity_conflict",
          message: `entity IDs are not found in project: ${missingEntityIds.join(", ")}`,
        });
      }
    }

    const dedupeKey = buildEventDedupeKey({
      chapterId: input.chapterId,
      title: input.title,
      summary: input.summary ?? null,
      entityIds,
    });

    const duplicateEvent = input.eventId
      ? database
          .select({ id: events.id })
          .from(events)
          .where(
            and(
              eq(events.projectId, input.projectId),
              eq(events.dedupeKey, dedupeKey),
              ne(events.status, "rejected"),
              ne(events.id, input.eventId),
            ),
          )
          .get()
      : database
          .select({ id: events.id })
          .from(events)
          .where(and(eq(events.projectId, input.projectId), eq(events.dedupeKey, dedupeKey), ne(events.status, "rejected")))
          .get();

    if (duplicateEvent) {
      conflicts.push({
        code: "duplicate_event",
        message: "duplicate event detected by dedupe key",
        relatedEventId: duplicateEvent.id,
      });
    }

    if (entityIds.length > 0) {
      const relatedTimelineRows = input.eventId
        ? database
            .select({
              entityId: eventEntities.entityId,
              relatedEventId: events.id,
              chapterOrder: events.chapterOrder,
              sequenceNo: events.sequenceNo,
            })
            .from(eventEntities)
            .innerJoin(events, eq(eventEntities.eventId, events.id))
            .where(
              and(
                eq(events.projectId, input.projectId),
                inArray(eventEntities.entityId, entityIds),
                ne(events.status, "rejected"),
                ne(events.id, input.eventId),
              ),
            )
            .orderBy(desc(events.chapterOrder), desc(events.sequenceNo))
            .all()
        : database
            .select({
              entityId: eventEntities.entityId,
              relatedEventId: events.id,
              chapterOrder: events.chapterOrder,
              sequenceNo: events.sequenceNo,
            })
            .from(eventEntities)
            .innerJoin(events, eq(eventEntities.eventId, events.id))
            .where(
              and(
                eq(events.projectId, input.projectId),
                inArray(eventEntities.entityId, entityIds),
                ne(events.status, "rejected"),
              ),
            )
            .orderBy(desc(events.chapterOrder), desc(events.sequenceNo))
            .all();

      const latestEventByEntity = new Map<string, (typeof relatedTimelineRows)[number]>();
      for (const relatedRow of relatedTimelineRows) {
        if (!latestEventByEntity.has(relatedRow.entityId)) {
          latestEventByEntity.set(relatedRow.entityId, relatedRow);
        }
      }

      const targetSequenceNo = input.sequenceNo ?? 0;
      for (const entityId of entityIds) {
        const latestRelated = latestEventByEntity.get(entityId);
        if (!latestRelated) {
          continue;
        }

        // 规则：比当前实体已知最新事件更早的位置，标记为时间顺序冲突。
        const isTimeOrderConflict =
          latestRelated.chapterOrder > input.chapterOrder ||
          (latestRelated.chapterOrder === input.chapterOrder &&
            latestRelated.sequenceNo > targetSequenceNo);

        if (isTimeOrderConflict) {
          conflicts.push({
            code: "time_order_conflict",
            message: "event position is earlier than latest existing event for this entity",
            entityId,
            eventId: input.eventId,
            relatedEventId: latestRelated.relatedEventId,
          });
        }
      }
    }

    return buildConflictResult(conflicts);
  }

  private filterValidEntityIds(database: AppDatabase, projectId: string, entityIds: string[]): string[] {
    if (entityIds.length === 0) {
      return [];
    }

    const rows = database
      .select({ id: entities.id })
      .from(entities)
      .where(and(eq(entities.projectId, projectId), inArray(entities.id, entityIds)))
      .all();
    const validEntityIdSet = new Set(rows.map((row) => row.id));
    return entityIds.filter((entityId) => validEntityIdSet.has(entityId));
  }

  private getEventEntityMap(database: AppDatabase, eventIds: string[]): Map<string, string[]> {
    const map = new Map<string, string[]>();
    if (eventIds.length === 0) {
      return map;
    }

    const rows = database
      .select({
        eventId: eventEntities.eventId,
        entityId: eventEntities.entityId,
      })
      .from(eventEntities)
      .where(inArray(eventEntities.eventId, eventIds))
      .orderBy(asc(eventEntities.eventId))
      .all();

    for (const row of rows) {
      const list = map.get(row.eventId) ?? [];
      list.push(row.entityId);
      map.set(row.eventId, list);
    }

    return map;
  }
}
