import {
  runTimelineExtractionWorkflow,
  type TimelineEntityCandidate,
  type TimelineEventCandidate,
} from "@/mastra/workflows/timeline-workflow";
import { ChaptersRepository } from "@/repositories/chapters-repository";
import { TimelineRepository } from "@/repositories/timeline-repository";

export type TimelineEventStatus = "auto" | "pending_review" | "confirmed" | "rejected";

export type RecomputeChapterTimelineInput = {
  projectId: string;
  chapterId: string;
  chapterNo?: number;
  chapterTitle?: string;
  chapterContent?: string;
  chapterSummary?: string | null;
  force?: boolean;
};

export type RecomputeChapterTimelineResult = {
  projectId: string;
  chapterId: string;
  chapterNo: number;
  extractedEntities: number;
  extractedEvents: number;
  validEvents: number;
  dedupedEvents: number;
  mergedEvents: number;
  lowConfidenceEvents: number;
  persistedEvents: number;
  queueBacklog: number;
};

type PersistableTimelineEntity = {
  projectId: string;
  name: string;
  normalizedName: string;
  aliases: string[];
  confidence: number;
  mentions: number;
};

type PersistableTimelineEvent = {
  eventId: string;
  projectId: string;
  chapterId: string;
  chapterNo: number;
  eventType: string;
  title: string;
  description: string;
  confidence: number;
  status: TimelineEventStatus;
  fingerprint: string;
  sentenceIndex: number;
  entityNames: string[];
  evidence: string;
};

type ExistingTimelineEvent = {
  eventId?: string;
  status?: TimelineEventStatus;
  confidence?: number;
  fingerprint?: string;
  chapterId?: string;
  eventType?: string;
  title?: string;
  description?: string;
  entityNames: string[];
};

type ResolvedChapter = {
  projectId: string;
  chapterId: string;
  chapterNo: number;
  chapterTitle?: string;
  chapterContent: string;
  chapterSummary?: string | null;
};

type TimelineFallbackRuntime = {
  chapterEvents: Map<string, PersistableTimelineEvent[]>;
};

type InvocationResult<T> = {
  called: boolean;
  value: T | undefined;
};

const LOW_CONFIDENCE_THRESHOLD = 0.72;
const FALLBACK_RUNTIME_KEY = "__catnovel_timeline_runtime_state__";

function getFallbackRuntime(): TimelineFallbackRuntime {
  const target = globalThis as typeof globalThis & {
    [FALLBACK_RUNTIME_KEY]?: TimelineFallbackRuntime;
  };
  if (!target[FALLBACK_RUNTIME_KEY]) {
    target[FALLBACK_RUNTIME_KEY] = {
      chapterEvents: new Map(),
    };
  }
  return target[FALLBACK_RUNTIME_KEY];
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return !!value && typeof value === "object" && typeof (value as PromiseLike<T>).then === "function";
}

async function invokeRepositoryMethod<T>(
  repository: unknown,
  methodNames: string[],
  argumentVariants: unknown[][],
): Promise<InvocationResult<T>> {
  if (!repository || typeof repository !== "object") {
    return { called: false, value: undefined };
  }

  const target = repository as Record<string, unknown>;
  let hadCallableMethod = false;
  let lastError: unknown;

  for (const methodName of methodNames) {
    const candidate = target[methodName];
    if (typeof candidate !== "function") {
      continue;
    }
    hadCallableMethod = true;

    for (const args of argumentVariants) {
      try {
        const result = (candidate as (...parameters: unknown[]) => unknown).apply(repository, args);
        if (isPromiseLike<T>(result)) {
          return { called: true, value: await result };
        }
        return { called: true, value: result as T };
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (hadCallableMethod && lastError) {
    throw lastError;
  }

  return { called: false, value: undefined };
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[“”"'`]/g, "")
    .replace(/[，。！？；,.!?;:：()\[\]【】《》<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return LOW_CONFIDENCE_THRESHOLD;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function readStringArray(record: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim());
    }
    if (typeof value === "string" && value.trim().length > 0) {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .map((item) => item.trim());
        }
      } catch {
        return value
          .split(/[，,]/g)
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      }
    }
  }
  return [];
}

function normalizeStatus(value: unknown): TimelineEventStatus | undefined {
  if (value === "auto" || value === "pending_review" || value === "confirmed" || value === "rejected") {
    return value;
  }
  if (value === "pendingReview") {
    return "pending_review";
  }
  return undefined;
}

function buildEventMergeKey(input: {
  fingerprint?: string;
  eventType?: string;
  title?: string;
  description?: string;
  entityNames?: string[];
}): string {
  if (input.fingerprint && input.fingerprint.trim().length > 0) {
    return `fingerprint:${input.fingerprint.trim()}`;
  }
  const eventType = normalizeText(input.eventType ?? "unknown_event");
  const title = normalizeText(input.title ?? "");
  const description = normalizeText(input.description ?? "");
  const entities = (input.entityNames ?? []).map((item) => normalizeText(item)).sort().join("|");
  return `${eventType}|${title}|${description}|${entities}`;
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function toEventId(projectId: string, chapterId: string, fingerprint: string): string {
  const source = `${projectId}:${chapterId}:${fingerprint}`;
  return `evt_${hashText(source)}`;
}

function normalizeEntityNames(raw: string[]): string[] {
  const unique = new Map<string, string>();
  for (const item of raw) {
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const key = normalizeText(trimmed);
    if (!unique.has(key)) {
      unique.set(key, trimmed);
    }
  }
  return [...unique.values()].slice(0, 8);
}

function registerEntityLookup(lookup: Map<string, string>, alias: string, entityId: string): void {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias || !entityId.trim()) {
    return;
  }
  lookup.set(normalizedAlias, entityId.trim());
}

function extractEntityIdFromResult(raw: unknown): string | undefined {
  const record = toRecord(raw);
  if (!record) {
    return undefined;
  }

  const directId = readString(record, ["entityId", "entity_id", "id"]);
  if (directId) {
    return directId;
  }

  const entityRecord = toRecord(record.entity);
  if (!entityRecord) {
    return undefined;
  }
  return readString(entityRecord, ["id"]);
}

function sortEvents(events: PersistableTimelineEvent[]): PersistableTimelineEvent[] {
  return [...events].sort((left, right) => {
    if (left.chapterNo !== right.chapterNo) {
      return left.chapterNo - right.chapterNo;
    }
    if (left.sentenceIndex !== right.sentenceIndex) {
      return left.sentenceIndex - right.sentenceIndex;
    }
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }
    return left.title.localeCompare(right.title);
  });
}

function normalizeEntityCandidate(
  projectId: string,
  candidate: TimelineEntityCandidate,
): PersistableTimelineEntity | null {
  const name = candidate.name.trim();
  if (name.length < 2) {
    return null;
  }
  const normalizedName = candidate.normalizedName.trim() || normalizeText(name);
  if (normalizedName.length < 2) {
    return null;
  }
  return {
    projectId,
    name,
    normalizedName,
    aliases: normalizeEntityNames(candidate.aliases),
    confidence: clampConfidence(candidate.confidence),
    mentions: Math.max(1, Math.trunc(candidate.mentions)),
  };
}

function normalizeEventCandidate(
  chapter: ResolvedChapter,
  candidate: TimelineEventCandidate,
): PersistableTimelineEvent | null {
  const title = candidate.title.trim();
  const description = candidate.description.trim();
  if (title.length === 0 || description.length === 0) {
    return null;
  }

  const fingerprintSeed = candidate.fingerprint.trim().length > 0
    ? candidate.fingerprint.trim()
    : hashText(
        `${chapter.chapterId}|${candidate.sentenceIndex}|${candidate.eventType}|${title}|${description}`,
      );
  const fingerprint = fingerprintSeed.startsWith("fp_") ? fingerprintSeed : `fp_${fingerprintSeed}`;
  const confidence = clampConfidence(candidate.confidence);

  return {
    eventId: toEventId(chapter.projectId, chapter.chapterId, fingerprint),
    projectId: chapter.projectId,
    chapterId: chapter.chapterId,
    chapterNo: chapter.chapterNo,
    eventType: candidate.eventType.trim() || "unknown_event",
    title,
    description,
    confidence,
    status: confidence < LOW_CONFIDENCE_THRESHOLD ? "pending_review" : "auto",
    fingerprint,
    sentenceIndex: Math.max(0, Math.trunc(candidate.sentenceIndex)),
    entityNames: normalizeEntityNames(candidate.entityNames),
    evidence: candidate.evidence.trim() || description,
  };
}

function parseExistingTimelineEvents(raw: unknown): ExistingTimelineEvent[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const output: ExistingTimelineEvent[] = [];
  for (const item of raw) {
    const record = toRecord(item);
    if (!record) {
      continue;
    }
    output.push({
      eventId: readString(record, ["eventId", "event_id", "id"]),
      status: normalizeStatus(record.status),
      confidence: readNumber(record, ["confidence"]),
      fingerprint: readString(record, ["fingerprint", "fingerprintHash", "fingerprint_hash"]),
      chapterId: readString(record, ["chapterId", "chapter_id"]),
      eventType: readString(record, ["eventType", "event_type", "type"]),
      title: readString(record, ["title"]),
      description: readString(record, ["description", "content"]),
      entityNames: readStringArray(record, ["entityNames", "entity_names", "entities"]),
    });
  }
  return output;
}

function dedupeEvents(input: PersistableTimelineEvent[]): {
  events: PersistableTimelineEvent[];
  removedCount: number;
} {
  const bestByKey = new Map<string, PersistableTimelineEvent>();
  for (const event of sortEvents(input)) {
    const key = buildEventMergeKey(event);
    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, event);
      continue;
    }
    if (event.confidence > existing.confidence) {
      bestByKey.set(key, event);
    }
  }
  return {
    events: sortEvents([...bestByKey.values()]),
    removedCount: input.length - bestByKey.size,
  };
}

function mergeWithExistingEvents(
  current: PersistableTimelineEvent[],
  existing: ExistingTimelineEvent[],
): { events: PersistableTimelineEvent[]; mergedCount: number } {
  const existingByKey = new Map<string, ExistingTimelineEvent>();
  for (const item of existing) {
    const key = buildEventMergeKey(item);
    if (!existingByKey.has(key)) {
      existingByKey.set(key, item);
    }
  }

  let mergedCount = 0;
  const mergedEvents = current.map((event) => {
    const existingEvent = existingByKey.get(buildEventMergeKey(event));
    if (!existingEvent) {
      return event;
    }
    mergedCount += 1;

    const status = existingEvent.status === "confirmed" || existingEvent.status === "rejected"
      ? existingEvent.status
      : event.status;

    return {
      ...event,
      eventId: existingEvent.eventId ?? event.eventId,
      status,
      confidence: Math.max(event.confidence, existingEvent.confidence ?? 0),
    };
  });

  return { events: mergedEvents, mergedCount };
}

function toRepositoryEventPayload(event: PersistableTimelineEvent): Record<string, unknown> {
  return {
    id: event.eventId,
    eventId: event.eventId,
    event_id: event.eventId,
    projectId: event.projectId,
    project_id: event.projectId,
    chapterId: event.chapterId,
    chapter_id: event.chapterId,
    chapterNo: event.chapterNo,
    chapter_no: event.chapterNo,
    eventType: event.eventType,
    event_type: event.eventType,
    title: event.title,
    description: event.description,
    confidence: event.confidence,
    status: event.status,
    fingerprint: event.fingerprint,
    sentenceIndex: event.sentenceIndex,
    sentence_index: event.sentenceIndex,
    entityNames: event.entityNames,
    entity_names: event.entityNames,
    evidence: event.evidence,
  };
}

function toRepositoryEntityPayload(entity: PersistableTimelineEntity): Record<string, unknown> {
  return {
    projectId: entity.projectId,
    project_id: entity.projectId,
    name: entity.name,
    normalizedName: entity.normalizedName,
    normalized_name: entity.normalizedName,
    aliases: entity.aliases,
    confidence: entity.confidence,
    mentions: entity.mentions,
  };
}

function fallbackKey(projectId: string, chapterId: string): string {
  return `${projectId}:${chapterId}`;
}

function putFallbackEvents(projectId: string, chapterId: string, events: PersistableTimelineEvent[]): void {
  const runtime = getFallbackRuntime();
  runtime.chapterEvents.set(fallbackKey(projectId, chapterId), [...events]);
}

function listFallbackEvents(projectId: string, chapterId: string): PersistableTimelineEvent[] {
  const runtime = getFallbackRuntime();
  return runtime.chapterEvents.get(fallbackKey(projectId, chapterId)) ?? [];
}

export class TimelineExtractionService {
  constructor(
    private readonly chaptersRepository = new ChaptersRepository(),
    private readonly timelineRepository: unknown = new TimelineRepository(),
  ) {}

  async recomputeChapterEvents(
    input: RecomputeChapterTimelineInput,
  ): Promise<RecomputeChapterTimelineResult> {
    const chapter = this.resolveChapter(input);

    const workflowOutput = await runTimelineExtractionWorkflow({
      projectId: chapter.projectId,
      chapterId: chapter.chapterId,
      chapterNo: chapter.chapterNo,
      chapterTitle: chapter.chapterTitle,
      content: chapter.chapterContent,
      summary: chapter.chapterSummary,
    });

    const entities = workflowOutput.entities
      .map((candidate) => normalizeEntityCandidate(chapter.projectId, candidate))
      .filter((candidate): candidate is PersistableTimelineEntity => candidate !== null);

    const entityLookup = await this.persistEntities(chapter.projectId, entities);

    const normalizedEvents = workflowOutput.events
      .map((candidate) => normalizeEventCandidate(chapter, candidate))
      .filter((candidate): candidate is PersistableTimelineEvent => candidate !== null);
    const validEvents = normalizedEvents.length;

    const deduped = dedupeEvents(normalizedEvents);
    const existingEvents = await this.listExistingChapterEvents(chapter.projectId, chapter.chapterId);
    const merged = mergeWithExistingEvents(deduped.events, existingEvents);

    const persistedEvents = await this.persistChapterEvents(
      chapter.projectId,
      chapter.chapterId,
      merged.events,
      entityLookup,
    );

    const pendingEvents = merged.events.filter((event) => event.status === "pending_review");
    const queueBacklog = await this.enqueuePendingReview(chapter.projectId, chapter.chapterId, pendingEvents);

    return {
      projectId: chapter.projectId,
      chapterId: chapter.chapterId,
      chapterNo: chapter.chapterNo,
      extractedEntities: workflowOutput.entities.length,
      extractedEvents: workflowOutput.events.length,
      validEvents,
      dedupedEvents: deduped.removedCount,
      mergedEvents: merged.mergedCount,
      lowConfidenceEvents: pendingEvents.length,
      persistedEvents,
      queueBacklog,
    };
  }

  private resolveChapter(input: RecomputeChapterTimelineInput): ResolvedChapter {
    if (
      typeof input.chapterNo === "number" &&
      Number.isFinite(input.chapterNo) &&
      typeof input.chapterContent === "string"
    ) {
      return {
        projectId: input.projectId,
        chapterId: input.chapterId,
        chapterNo: input.chapterNo,
        chapterTitle: input.chapterTitle,
        chapterContent: input.chapterContent,
        chapterSummary: input.chapterSummary,
      };
    }

    const chapter = this.chaptersRepository.findById(input.projectId, input.chapterId);
    if (!chapter) {
      throw new Error(`chapter not found: ${input.chapterId}`);
    }

    return {
      projectId: chapter.projectId,
      chapterId: chapter.id,
      chapterNo: chapter.orderNo,
      chapterTitle: chapter.title,
      chapterContent: chapter.content ?? "",
      chapterSummary: chapter.summary ?? null,
    };
  }

  private async listExistingChapterEvents(
    projectId: string,
    chapterId: string,
  ): Promise<ExistingTimelineEvent[]> {
    const response = await invokeRepositoryMethod<unknown>(this.timelineRepository, [
      "listEventsByChapter",
      "findEventsByChapter",
      "listByChapter",
      "listChapterEvents",
    ], [
      [{ projectId, chapterId }],
      [projectId, chapterId],
      [chapterId],
    ]);

    if (response.called) {
      return parseExistingTimelineEvents(response.value);
    }

    return listFallbackEvents(projectId, chapterId);
  }

  private async persistEntities(
    projectId: string,
    entities: PersistableTimelineEntity[],
  ): Promise<Map<string, string>> {
    const lookup = new Map<string, string>();
    if (entities.length === 0) {
      return lookup;
    }

    for (const entity of entities) {
      const normalizeResult = await invokeRepositoryMethod<unknown>(this.timelineRepository, [
        "normalizeEntityAndAliases",
      ], [
        [
          {
            projectId,
            name: entity.name,
            aliases: entity.aliases,
            type: "other",
          },
        ],
        [projectId, toRepositoryEntityPayload(entity)],
      ]);

      let entityId = normalizeResult.called ? extractEntityIdFromResult(normalizeResult.value) : undefined;

      if (!normalizeResult.called) {
        const fallbackPayload = toRepositoryEntityPayload(entity);
        const single = await invokeRepositoryMethod<unknown>(this.timelineRepository, [
          "upsertEntity",
          "ensureEntity",
          "saveEntity",
        ], [
          [fallbackPayload],
          [projectId, fallbackPayload],
        ]);

        entityId = single.called ? extractEntityIdFromResult(single.value) : undefined;
      }

      if (!entityId) {
        const findResult = await invokeRepositoryMethod<unknown>(this.timelineRepository, [
          "findEntityByNameOrAlias",
        ], [
          [projectId, entity.name],
          [{ projectId, rawNameOrAlias: entity.name }],
        ]);
        if (findResult.called) {
          entityId = extractEntityIdFromResult(findResult.value);
        }
      }

      if (!entityId) {
        continue;
      }

      registerEntityLookup(lookup, entity.name, entityId);
      registerEntityLookup(lookup, entity.normalizedName, entityId);
      for (const alias of entity.aliases) {
        registerEntityLookup(lookup, alias, entityId);
      }
    }

    return lookup;
  }

  private async resolveEntityId(
    projectId: string,
    entityName: string,
    lookup: Map<string, string>,
  ): Promise<string | undefined> {
    const normalized = normalizeText(entityName);
    if (!normalized) {
      return undefined;
    }

    const cached = lookup.get(normalized);
    if (cached) {
      return cached;
    }

    const findResult = await invokeRepositoryMethod<unknown>(this.timelineRepository, [
      "findEntityByNameOrAlias",
    ], [
      [projectId, entityName],
      [{ projectId, rawNameOrAlias: entityName }],
    ]);
    const foundId = findResult.called ? extractEntityIdFromResult(findResult.value) : undefined;
    if (foundId) {
      registerEntityLookup(lookup, entityName, foundId);
      return foundId;
    }

    const normalizeResult = await invokeRepositoryMethod<unknown>(this.timelineRepository, [
      "normalizeEntityAndAliases",
    ], [
      [{ projectId, name: entityName, aliases: [entityName], type: "other" }],
    ]);
    const createdId = normalizeResult.called ? extractEntityIdFromResult(normalizeResult.value) : undefined;
    if (createdId) {
      registerEntityLookup(lookup, entityName, createdId);
      return createdId;
    }

    return undefined;
  }

  private async resolveEntityIds(
    projectId: string,
    entityNames: string[],
    lookup: Map<string, string>,
  ): Promise<string[]> {
    const uniqueIds = new Set<string>();
    for (const entityName of entityNames) {
      const entityId = await this.resolveEntityId(projectId, entityName, lookup);
      if (entityId) {
        uniqueIds.add(entityId);
      }
    }
    return [...uniqueIds];
  }

  private async persistChapterEvents(
    projectId: string,
    chapterId: string,
    events: PersistableTimelineEvent[],
    entityLookup: Map<string, string>,
  ): Promise<number> {
    const repositoryRecord = toRecord(this.timelineRepository);
    const hasNativeRebuildFlow =
      !!repositoryRecord &&
      typeof repositoryRecord.deleteByChapterForRebuild === "function" &&
      typeof repositoryRecord.upsertEventWithSnapshot === "function";

    if (hasNativeRebuildFlow) {
      await invokeRepositoryMethod<unknown>(this.timelineRepository, ["deleteByChapterForRebuild"], [
        [projectId, chapterId],
        [{ projectId, chapterId }],
      ]);

      const sorted = sortEvents(events);
      for (let index = 0; index < sorted.length; index += 1) {
        const event = sorted[index];
        const entityIds = await this.resolveEntityIds(projectId, event.entityNames, entityLookup);

        await invokeRepositoryMethod<unknown>(this.timelineRepository, ["upsertEventWithSnapshot"], [
          [
            {
              id: event.eventId,
              projectId,
              chapterId,
              chapterOrder: event.chapterNo,
              sequenceNo: index,
              title: event.title,
              summary: event.description,
              evidence: event.evidence,
              confidence: event.confidence,
              status: event.status,
              entityIds,
            },
          ],
        ]);
      }

      return events.length;
    }

    const payload = events.map((event) => toRepositoryEventPayload(event));

    // 硬切换策略：以章节为单位覆盖写入，不保留旧抽取兼容分支。
    const bulkReplace = await invokeRepositoryMethod<unknown>(this.timelineRepository, [
      "replaceChapterEvents",
      "replaceEventsByChapter",
      "upsertChapterEvents",
      "saveChapterEvents",
    ], [
      [{ projectId, chapterId, events: payload }],
      [projectId, chapterId, payload],
      [chapterId, payload],
    ]);

    if (bulkReplace.called) {
      return events.length;
    }

    let repositoryAcceptedAnyWrite = false;

    const clearResult = await invokeRepositoryMethod<unknown>(this.timelineRepository, [
      "deleteEventsByChapter",
      "removeEventsByChapter",
      "clearChapterEvents",
    ], [
      [{ projectId, chapterId }],
      [projectId, chapterId],
      [chapterId],
    ]);
    repositoryAcceptedAnyWrite ||= clearResult.called;

    for (const event of payload) {
      const upsertResult = await invokeRepositoryMethod<unknown>(this.timelineRepository, [
        "upsertEvent",
        "saveEvent",
        "createEvent",
        "insertEvent",
      ], [
        [event],
        [projectId, event],
        [chapterId, event],
      ]);
      repositoryAcceptedAnyWrite ||= upsertResult.called;
    }

    if (!repositoryAcceptedAnyWrite) {
      putFallbackEvents(projectId, chapterId, events);
    }

    return events.length;
  }

  private async enqueuePendingReview(
    projectId: string,
    chapterId: string,
    pendingEvents: PersistableTimelineEvent[],
  ): Promise<number> {
    if (pendingEvents.length === 0) {
      return 0;
    }

    const payload = pendingEvents.map((event) => toRepositoryEventPayload(event));
    const bulkQueue = await invokeRepositoryMethod<unknown>(this.timelineRepository, [
      "enqueuePendingReviewEvents",
      "enqueueReviewEvents",
      "enqueuePendingReview",
    ], [
      [{ projectId, chapterId, events: payload }],
      [projectId, chapterId, payload],
      [payload],
    ]);

    if (bulkQueue.called) {
      return pendingEvents.length;
    }

    let queuedByRepository = false;
    for (const event of payload) {
      const singleQueue = await invokeRepositoryMethod<unknown>(this.timelineRepository, [
        "enqueueEventReview",
        "queueReview",
        "queuePendingReviewEvent",
      ], [
        [event],
        [projectId, chapterId, event],
      ]);
      queuedByRepository ||= singleQueue.called;
    }

    if (!queuedByRepository) {
      // 无独立审核队列实现时，pending_review 状态本身即为审核队列。
      return pendingEvents.length;
    }

    return pendingEvents.length;
  }
}

const timelineExtractionService = new TimelineExtractionService();

export { timelineExtractionService };

export async function recomputeChapterTimelineEvents(
  input: RecomputeChapterTimelineInput,
): Promise<RecomputeChapterTimelineResult> {
  return timelineExtractionService.recomputeChapterEvents(input);
}
