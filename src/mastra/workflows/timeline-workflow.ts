import { streamTextFromProvider, type ChatMessage } from "@/core/llm";
import { LlmDefaultSelectionRepository } from "@/repositories/llm-default-selection-repository";

export type TimelineWorkflowInput = {
  projectId: string;
  chapterId: string;
  chapterNo: number;
  chapterTitle?: string;
  content: string;
  summary?: string | null;
};

export type TimelineEntityCandidate = {
  name: string;
  normalizedName: string;
  aliases: string[];
  mentions: number;
  confidence: number;
};

export type TimelineEventCandidate = {
  fingerprint: string;
  chapterId: string;
  chapterNo: number;
  sentenceIndex: number;
  eventType: string;
  title: string;
  description: string;
  entityNames: string[];
  confidence: number;
  status: "auto" | "pending_review";
  evidence: string;
  reviewReason?: string;
  governanceTags?: string[];
};

export type TimelineWorkflowOutput = {
  workflow: "timeline.extract.v2";
  entities: TimelineEntityCandidate[];
  events: TimelineEventCandidate[];
  diagnostics: {
    sentenceCount: number;
    matchedSentenceCount: number;
    pendingReviewThreshold: number;
    rawEntityCount: number;
    rawEventCount: number;
    acceptedEventCount: number;
    droppedEventCount: number;
    llmModel?: string;
    llmRequestId?: string;
    governanceWarnings: string[];
    generatedAt: string;
  };
};

const LOW_CONFIDENCE_THRESHOLD = 0.72;
const MIN_EVENT_CONFIDENCE = 0;
const MAX_EVENT_CONFIDENCE = 0.99;
const MAX_EVENT_PER_CHAPTER = 200;
const MAX_ENTITY_PER_CHAPTER = 300;
const DEFAULT_LLM_TIMEOUT_MS = 45_000;
const LLM_TIMEOUT_ENV = "CATNOVEL_TIMELINE_LLM_TIMEOUT_MS";

const defaultSelectionRepository = new LlmDefaultSelectionRepository();

const EVENT_TYPE_WHITELIST = new Set([
  "death",
  "injury",
  "conflict",
  "meeting",
  "arrival",
  "departure",
  "discovery",
  "decision",
  "status_change",
  "relationship",
  "unknown_event",
]);

const UNCERTAIN_MARKER_REGEX = /(似乎|仿佛|可能|也许|大概|传闻|听说|好像)/;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[“”"'`]/g, "")
    .replace(/[，。！？；,.!?;:：()\[\]【】《》<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFingerprintText(text: string): string {
  return normalizeToken(text);
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function splitSentences(text: string): string[] {
  return text
    .split(/[。！？!?；;\n]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    if (typeof value === "string" && value.trim().length > 0) {
      return value
        .split(/[，,]/g)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
  }
  return [];
}

function extractFirstJsonObject(input: string): string | null {
  const text = input.trim();
  if (text.length === 0) {
    return null;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    if (candidate.startsWith("{") || candidate.startsWith("[")) {
      return candidate;
    }
  }

  const firstBrace = text.search(/[\[{]/);
  if (firstBrace === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let index = firstBrace; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }

  if (end === -1) {
    return null;
  }

  return text.slice(firstBrace, end + 1);
}

type LlmStructuredPayload = {
  entities: unknown[];
  events: unknown[];
  llmModel?: string;
  llmRequestId?: string;
};

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const candidate = extractFirstJsonObject(value);
  if (!candidate) {
    return value;
  }
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return value;
  }
}

function parseLlmStructuredPayload(payload: unknown): LlmStructuredPayload {
  const queue: unknown[] = [payload];

  while (queue.length > 0) {
    const current = parseJsonValue(queue.shift());
    const record = toRecord(current);
    if (!record) {
      continue;
    }

    if (Array.isArray(record.entities) && Array.isArray(record.events)) {
      return {
        entities: record.entities,
        events: record.events,
        llmModel: readString(record, ["model", "llmModel", "modelId"]),
        llmRequestId: readString(record, ["requestId", "llmRequestId", "id"]),
      };
    }

    const dataRecord = toRecord(record.data);
    if (dataRecord) {
      queue.push(dataRecord);
    }

    const choices = Array.isArray(record.choices) ? record.choices : [];
    for (const choice of choices) {
      const choiceRecord = toRecord(choice);
      if (!choiceRecord) {
        continue;
      }
      queue.push(choiceRecord.message);
      queue.push(choiceRecord.delta);
      queue.push(choiceRecord.text);
    }

    const messageRecord = toRecord(record.message);
    if (messageRecord) {
      queue.push(messageRecord.content);
    }

    const output = Array.isArray(record.output) ? record.output : [];
    for (const outputItem of output) {
      const outputRecord = toRecord(outputItem);
      if (!outputRecord) {
        continue;
      }
      queue.push(outputRecord.content);
      queue.push(outputRecord.text);
    }

    const content = Array.isArray(record.content) ? record.content : [];
    for (const contentItem of content) {
      const contentRecord = toRecord(contentItem);
      if (!contentRecord) {
        queue.push(contentItem);
        continue;
      }
      queue.push(contentRecord.text);
      queue.push(contentRecord.value);
      queue.push(contentRecord.output_text);
    }

    queue.push(record.output_text);
    queue.push(record.text);
  }

  throw new Error("timeline llm payload is missing entities/events arrays");
}

function resolveTimelineChatPresetId(projectId: string): string {
  const defaults = defaultSelectionRepository.getByProjectId(projectId);
  const presetId = defaults?.defaultChatPresetId?.trim();
  if (!presetId) {
    throw new Error("timeline chat preset is not configured for project");
  }
  return presetId;
}

function resolveLlmTimeoutMs(): number {
  const raw = process.env[LLM_TIMEOUT_ENV];
  if (!raw) {
    return DEFAULT_LLM_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LLM_TIMEOUT_MS;
  }
  return Math.trunc(parsed);
}

function buildTimelineMessages(input: TimelineWorkflowInput): ChatMessage[] {
  const eventTypes = [...EVENT_TYPE_WHITELIST].join(", ");
  const chapterPayload = {
    projectId: input.projectId,
    chapterId: input.chapterId,
    chapterNo: input.chapterNo,
    chapterTitle: input.chapterTitle ?? "",
    summary: input.summary ?? "",
    content: input.content,
    constraints: {
      pendingReviewThreshold: LOW_CONFIDENCE_THRESHOLD,
      eventTypeWhitelist: [...EVENT_TYPE_WHITELIST],
    },
  };

  return [
    {
      role: "system",
      content: [
        "你是中文小说时间线抽取器。",
        "仅输出一个 JSON 对象，禁止 markdown 代码块、解释文本或额外字段。",
        "JSON 顶层必须包含 entities 与 events 两个数组。",
        "entities[] 字段: name, aliases, mentions, confidence。",
        "events[] 字段: eventType, title, description, entityNames, sentenceIndex, confidence, evidence。",
        `eventType 仅允许: ${eventTypes}；未知类型使用 unknown_event。`,
        "请保留低置信度事件，不要主动过滤。",
        "不要虚构章节中不存在的信息。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "请从以下章节内容抽取结构化时间线数据，按约定字段返回 JSON：",
        JSON.stringify(chapterPayload, null, 2),
      ].join("\n\n"),
    },
  ];
}

async function invokeTimelineLlm(input: TimelineWorkflowInput): Promise<LlmStructuredPayload> {
  const chatPresetId = resolveTimelineChatPresetId(input.projectId);
  const timeoutMs = resolveLlmTimeoutMs();
  const messages = buildTimelineMessages(input);

  const controller = new AbortController();
  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const chunks: string[] = [];
    for await (const token of streamTextFromProvider({
      requestTag: "generate",
      projectId: input.projectId,
      chatPresetId,
      messages,
      signal: controller.signal,
    })) {
      chunks.push(token);
    }

    const rawBody = chunks.join("").trim();
    if (!rawBody) {
      throw new Error("timeline llm payload is empty");
    }

    const parsed = parseLlmStructuredPayload(rawBody);
    if (!parsed.llmModel) {
      parsed.llmModel = chatPresetId;
    }
    return parsed;
  } catch (error) {
    if (timedOut) {
      throw new Error(`timeline llm request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function sanitizeEntityName(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^[“"'`《【\[(]+/, "")
    .replace(/[”"'`》】\])]+$/, "")
    .replace(/^(老|小|阿)/, "")
    .trim();

  if (cleaned.length < 2 || cleaned.length > 48) {
    return null;
  }
  if (/^\d+$/.test(cleaned)) {
    return null;
  }

  if (/^[\u4e00-\u9fff]{2,8}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^[A-Za-z][A-Za-z\s\-.]{1,47}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

function normalizeEntityName(name: string): string {
  if (/[\u4e00-\u9fff]/.test(name)) {
    return name;
  }
  return name.toLowerCase();
}

function normalizeEventType(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return "unknown_event";
  }

  const token = normalizeToken(raw).replace(/\s+/g, "_");
  if (EVENT_TYPE_WHITELIST.has(token)) {
    return token;
  }

  if (token.includes("death") || token.includes("killed") || token.includes("死亡")) {
    return "death";
  }
  if (token.includes("injury") || token.includes("受伤")) {
    return "injury";
  }
  if (token.includes("meeting") || token.includes("会面")) {
    return "meeting";
  }
  if (token.includes("conflict") || token.includes("冲突") || token.includes("battle")) {
    return "conflict";
  }
  if (token.includes("arrival") || token.includes("抵达")) {
    return "arrival";
  }
  if (token.includes("departure") || token.includes("离开")) {
    return "departure";
  }
  if (token.includes("decision") || token.includes("决定")) {
    return "decision";
  }
  if (token.includes("relationship") || token.includes("关系")) {
    return "relationship";
  }
  if (token.includes("discover") || token.includes("发现")) {
    return "discovery";
  }
  if (token.includes("status") || token.includes("身份")) {
    return "status_change";
  }

  return "unknown_event";
}

function dedupeNames(input: string[]): string[] {
  const unique = new Map<string, string>();
  for (const name of input) {
    const sanitized = sanitizeEntityName(name);
    if (!sanitized) {
      continue;
    }
    const normalized = normalizeEntityName(sanitized);
    if (!unique.has(normalized)) {
      unique.set(normalized, sanitized);
    }
  }
  return [...unique.values()];
}

function toNonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }
  return fallback;
}

function buildEntityCandidates(
  rawEntities: unknown[],
  eventEntityMentions: Map<string, { name: string; mentions: number }>,
): TimelineEntityCandidate[] {
  const candidates = new Map<string, TimelineEntityCandidate>();

  for (const rawEntity of rawEntities) {
    const record = toRecord(rawEntity);
    if (!record) {
      continue;
    }

    const name = sanitizeEntityName(readString(record, ["name", "entity", "entityName"]) ?? "");
    if (!name) {
      continue;
    }

    const normalizedName = normalizeEntityName(name);
    const aliases = dedupeNames([name, ...readStringArray(record, ["aliases", "aliasNames"])]);
    const mentions = Math.max(1, toNonNegativeInteger(readNumber(record, ["mentions", "mentionCount"]), 1));
    const confidence = clamp(readNumber(record, ["confidence", "score"]) ?? 0.7, 0.2, 0.99);

    candidates.set(normalizedName, {
      name,
      normalizedName,
      aliases,
      mentions,
      confidence,
    });
  }

  for (const [normalizedName, mention] of eventEntityMentions.entries()) {
    const existing = candidates.get(normalizedName);
    if (existing) {
      existing.mentions = Math.max(existing.mentions, mention.mentions);
      existing.confidence = Math.max(existing.confidence, clamp(0.55 + mention.mentions * 0.08, 0.3, 0.95));
      if (!existing.aliases.includes(mention.name)) {
        existing.aliases.push(mention.name);
      }
      continue;
    }

    candidates.set(normalizedName, {
      name: mention.name,
      normalizedName,
      aliases: [mention.name],
      mentions: mention.mentions,
      confidence: clamp(0.5 + mention.mentions * 0.1, 0.3, 0.93),
    });
  }

  return [...candidates.values()]
    .slice(0, MAX_ENTITY_PER_CHAPTER)
    .sort((left, right) => {
      if (right.mentions !== left.mentions) {
        return right.mentions - left.mentions;
      }
      return right.confidence - left.confidence;
    });
}

function normalizeEventCandidate(input: {
  chapterId: string;
  chapterNo: number;
  fallbackSentenceIndex: number;
  rawEvent: unknown;
}): TimelineEventCandidate | null {
  const record = toRecord(input.rawEvent);
  if (!record) {
    return null;
  }

  const title = (readString(record, ["title", "name"]) ?? "").trim();
  const description = (readString(record, ["description", "summary", "content"]) ?? "").trim();
  if (!title || !description) {
    return null;
  }

  const eventType = normalizeEventType(readString(record, ["eventType", "type", "category"]));
  const sentenceIndex = toNonNegativeInteger(
    readNumber(record, ["sentenceIndex", "sequenceNo", "index"]),
    input.fallbackSentenceIndex,
  );

  const entityNames = dedupeNames(
    readStringArray(record, ["entityNames", "entities", "participants", "entity_aliases"]),
  ).slice(0, 8);

  const evidence = (
    readString(record, ["evidence", "evidenceSnippet", "quote", "snippet"]) ??
    description
  ).trim();

  const confidence = clamp(
    readNumber(record, ["confidence", "score", "probability"]) ?? 0.5,
    MIN_EVENT_CONFIDENCE,
    MAX_EVENT_CONFIDENCE,
  );

  const governanceTags: string[] = [];
  if (confidence < LOW_CONFIDENCE_THRESHOLD) {
    governanceTags.push("low_confidence");
  }
  if (entityNames.length === 0) {
    governanceTags.push("entity_missing");
  }
  if (evidence.length < 8) {
    governanceTags.push("weak_evidence");
  }
  if (UNCERTAIN_MARKER_REGEX.test(`${description} ${evidence}`)) {
    governanceTags.push("uncertain_language");
  }

  const needsReview =
    governanceTags.includes("low_confidence") ||
    governanceTags.includes("weak_evidence") ||
    governanceTags.includes("uncertain_language");

  const fingerprintSeed =
    readString(record, ["fingerprint", "fingerprintHash", "id"]) ??
    hashText(
      normalizeFingerprintText(
        `${input.chapterId}|${sentenceIndex}|${eventType}|${title}|${description}|${entityNames.join("|")}`,
      ),
    );

  const fingerprint = fingerprintSeed.startsWith("fp_") ? fingerprintSeed : `fp_${fingerprintSeed}`;

  return {
    fingerprint,
    chapterId: input.chapterId,
    chapterNo: input.chapterNo,
    sentenceIndex,
    eventType,
    title,
    description,
    entityNames,
    confidence,
    status: needsReview ? "pending_review" : "auto",
    evidence,
    reviewReason: needsReview ? governanceTags.join(",") : undefined,
    governanceTags,
  };
}

function dedupeEvents(events: TimelineEventCandidate[]): TimelineEventCandidate[] {
  const bestByFingerprint = new Map<string, TimelineEventCandidate>();

  for (const event of events) {
    const existing = bestByFingerprint.get(event.fingerprint);
    if (!existing || event.confidence > existing.confidence) {
      bestByFingerprint.set(event.fingerprint, event);
    }
  }

  return [...bestByFingerprint.values()]
    .slice(0, MAX_EVENT_PER_CHAPTER)
    .sort((left, right) => {
      if (left.sentenceIndex !== right.sentenceIndex) {
        return left.sentenceIndex - right.sentenceIndex;
      }
      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }
      return left.title.localeCompare(right.title);
    });
}

export async function runTimelineExtractionWorkflow(
  input: TimelineWorkflowInput,
): Promise<TimelineWorkflowOutput> {
  const sourceText = normalizeWhitespace([input.summary ?? "", input.content].filter(Boolean).join("\n"));
  const sentences = splitSentences(sourceText);

  const llmPayload = await invokeTimelineLlm(input);

  const normalizedEvents = llmPayload.events
    .map((rawEvent, index) =>
      normalizeEventCandidate({
        chapterId: input.chapterId,
        chapterNo: input.chapterNo,
        fallbackSentenceIndex: index,
        rawEvent,
      }),
    )
    .filter((event): event is TimelineEventCandidate => event !== null);

  const events = dedupeEvents(normalizedEvents);

  const eventEntityMentions = new Map<string, { name: string; mentions: number }>();
  for (const event of events) {
    for (const entityName of event.entityNames) {
      const normalizedName = normalizeEntityName(entityName);
      const existing = eventEntityMentions.get(normalizedName);
      if (existing) {
        existing.mentions += 1;
      } else {
        eventEntityMentions.set(normalizedName, {
          name: entityName,
          mentions: 1,
        });
      }
    }
  }

  const entities = buildEntityCandidates(llmPayload.entities, eventEntityMentions);

  const warnings: string[] = [];
  if (llmPayload.events.length > MAX_EVENT_PER_CHAPTER) {
    warnings.push(`llm_events_truncated:${llmPayload.events.length}->${MAX_EVENT_PER_CHAPTER}`);
  }
  if (llmPayload.entities.length > MAX_ENTITY_PER_CHAPTER) {
    warnings.push(`llm_entities_truncated:${llmPayload.entities.length}->${MAX_ENTITY_PER_CHAPTER}`);
  }
  if (events.length === 0) {
    warnings.push("llm_returned_no_valid_events");
  }

  const matchedSentenceCount = new Set(events.map((event) => event.sentenceIndex)).size;

  return {
    workflow: "timeline.extract.v2",
    entities,
    events,
    diagnostics: {
      sentenceCount: sentences.length,
      matchedSentenceCount,
      pendingReviewThreshold: LOW_CONFIDENCE_THRESHOLD,
      rawEntityCount: llmPayload.entities.length,
      rawEventCount: llmPayload.events.length,
      acceptedEventCount: events.length,
      droppedEventCount: llmPayload.events.length - events.length,
      llmModel: llmPayload.llmModel,
      llmRequestId: llmPayload.llmRequestId,
      governanceWarnings: warnings,
      generatedAt: new Date().toISOString(),
    },
  };
}
