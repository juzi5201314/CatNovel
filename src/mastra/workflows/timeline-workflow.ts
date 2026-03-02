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
};

export type TimelineWorkflowOutput = {
  workflow: "timeline.extract.v1";
  entities: TimelineEntityCandidate[];
  events: TimelineEventCandidate[];
  diagnostics: {
    sentenceCount: number;
    matchedSentenceCount: number;
    pendingReviewThreshold: number;
    generatedAt: string;
  };
};

const LOW_CONFIDENCE_THRESHOLD = 0.72;
const MIN_EVENT_CONFIDENCE = 0.35;
const MAX_EVENT_CONFIDENCE = 0.99;
const MAX_EVENT_PER_CHAPTER = 200;

type EventRule = {
  eventType: string;
  actionLabel: string;
  keywords: string[];
  baseConfidence: number;
};

const EVENT_RULES: EventRule[] = [
  {
    eventType: "death",
    actionLabel: "死亡",
    keywords: ["死亡", "死去", "牺牲", "被杀", "身亡"],
    baseConfidence: 0.93,
  },
  {
    eventType: "injury",
    actionLabel: "受伤",
    keywords: ["受伤", "重伤", "流血", "昏迷"],
    baseConfidence: 0.85,
  },
  {
    eventType: "conflict",
    actionLabel: "冲突",
    keywords: ["争吵", "争执", "冲突", "对峙", "决斗", "战斗", "袭击"],
    baseConfidence: 0.81,
  },
  {
    eventType: "meeting",
    actionLabel: "会面",
    keywords: ["遇见", "重逢", "会面", "见到", "碰到"],
    baseConfidence: 0.77,
  },
  {
    eventType: "arrival",
    actionLabel: "抵达",
    keywords: ["来到", "抵达", "进入", "回到", "返回"],
    baseConfidence: 0.74,
  },
  {
    eventType: "departure",
    actionLabel: "离开",
    keywords: ["离开", "出发", "逃离", "撤离"],
    baseConfidence: 0.74,
  },
  {
    eventType: "discovery",
    actionLabel: "发现",
    keywords: ["发现", "得知", "意识到", "看见", "目击"],
    baseConfidence: 0.71,
  },
  {
    eventType: "decision",
    actionLabel: "决定",
    keywords: ["决定", "发誓", "承诺", "同意", "拒绝"],
    baseConfidence: 0.69,
  },
  {
    eventType: "status_change",
    actionLabel: "身份变化",
    keywords: ["成为", "任命", "担任", "继任", "罢免"],
    baseConfidence: 0.8,
  },
  {
    eventType: "relationship",
    actionLabel: "关系变化",
    keywords: ["结婚", "订婚", "分手", "和好", "告白"],
    baseConfidence: 0.82,
  },
];

const ENTITY_STOP_WORDS = new Set([
  "他们",
  "我们",
  "你们",
  "自己",
  "大家",
  "这里",
  "那里",
  "今天",
  "昨天",
  "明天",
  "时候",
  "事情",
  "问题",
  "情况",
  "结果",
  "声音",
  "空气",
  "目光",
  "时间",
  "地方",
  "故事",
  "章节",
  "因此",
  "然后",
  "但是",
  "如果",
  "虽然",
  "已经",
  "没有",
  "一个",
  "这个",
  "那个",
  "一些",
  "一种",
  "终于",
  "忽然",
  "突然",
  "于是",
]);

const UNCERTAIN_MARKER_REGEX = /(似乎|仿佛|可能|也许|大概|传闻|听说|好像)/;
const TIME_MARKER_REGEX = /(当晚|翌日|次日|次晨|当天|同日|三天后|一周后|几小时后|当时)/;
const QUESTION_MARKER_REGEX = /[？?]/;
const ENTITY_ACTION_CONTEXT_REGEX =
  /(说|问|看|听|想|决定|发现|遇见|抵达|进入|离开|受伤|死亡|杀|救|帮助|追|逃|宣布|命令|任命|结婚|分手|争吵|冲突|战斗|会面)/;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeFingerprintText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"'`]/g, "")
    .replace(/[，。！？；,.!?;:：()\[\]【】《》<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function sanitizeEntityName(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^[“"'`《【\[(]+/, "")
    .replace(/[”"'`》】\])]+$/, "")
    .replace(/^(老|小|阿)/, "")
    .trim();

  if (cleaned.length < 2 || cleaned.length > 32) {
    return null;
  }
  if (/^\d+$/.test(cleaned)) {
    return null;
  }
  if (ENTITY_STOP_WORDS.has(cleaned)) {
    return null;
  }
  if (/^[\u4e00-\u9fff]{2,4}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}$/.test(cleaned)) {
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

function extractEntityMentions(sentence: string): string[] {
  const chineseTokens = sentence.match(/[\u4e00-\u9fff]{2,4}/g) ?? [];
  const englishTokens = sentence.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/g) ?? [];
  const rawTokens = [...chineseTokens, ...englishTokens];

  const mentions = new Map<string, string>();
  for (const token of rawTokens) {
    const candidate = sanitizeEntityName(token);
    if (!candidate) {
      continue;
    }
    const normalized = normalizeEntityName(candidate);
    const current = mentions.get(normalized);
    if (!current || candidate.length > current.length) {
      mentions.set(normalized, candidate);
    }
  }
  return [...mentions.values()];
}

function hasEntityContext(sentence: string, entityName: string): boolean {
  if (!ENTITY_ACTION_CONTEXT_REGEX.test(sentence)) {
    return false;
  }
  return sentence.includes(entityName);
}

function calculateEventConfidence(
  rule: EventRule,
  sentence: string,
  entityCount: number,
): number {
  let score = rule.baseConfidence;

  if (entityCount >= 1) {
    score += 0.06;
  }
  if (entityCount >= 2) {
    score += 0.05;
  }
  if (TIME_MARKER_REGEX.test(sentence)) {
    score += 0.05;
  }
  if (sentence.length < 8 || sentence.length > 100) {
    score -= 0.06;
  }
  if (QUESTION_MARKER_REGEX.test(sentence)) {
    score -= 0.08;
  }
  if (UNCERTAIN_MARKER_REGEX.test(sentence)) {
    score -= 0.2;
  }

  return clamp(score, MIN_EVENT_CONFIDENCE, MAX_EVENT_CONFIDENCE);
}

function buildEventTitle(entityNames: string[], actionLabel: string): string {
  if (entityNames.length === 0) {
    return `${actionLabel}事件`;
  }
  if (entityNames.length === 1) {
    return `${entityNames[0]}${actionLabel}`;
  }
  return `${entityNames[0]}与${entityNames[1]}${actionLabel}`;
}

function pickMatchedRules(sentence: string): EventRule[] {
  const matched = EVENT_RULES.filter((rule) => rule.keywords.some((keyword) => sentence.includes(keyword)));
  if (matched.length <= 2) {
    return matched;
  }
  return matched.slice(0, 2);
}

type EntityAggregate = {
  name: string;
  aliases: Set<string>;
  mentions: number;
  eventMentions: number;
};

function buildEntityAggregate(sentences: string[]): Map<string, EntityAggregate> {
  const aggregate = new Map<string, EntityAggregate>();
  for (const sentence of sentences) {
    for (const mention of extractEntityMentions(sentence)) {
      if (!hasEntityContext(sentence, mention)) {
        continue;
      }
      const normalized = normalizeEntityName(mention);
      const existing = aggregate.get(normalized);
      if (existing) {
        existing.mentions += 1;
        existing.aliases.add(mention);
      } else {
        aggregate.set(normalized, {
          name: mention,
          aliases: new Set([mention]),
          mentions: 1,
          eventMentions: 0,
        });
      }
    }
  }
  return aggregate;
}

function buildEntityCandidates(aggregate: Map<string, EntityAggregate>): TimelineEntityCandidate[] {
  const result: TimelineEntityCandidate[] = [];
  for (const [normalizedName, item] of aggregate.entries()) {
    if (item.mentions < 2 && item.eventMentions < 1) {
      continue;
    }
    const confidence = clamp(0.42 + item.mentions * 0.09 + item.eventMentions * 0.14, 0.4, 0.98);
    result.push({
      name: item.name,
      normalizedName,
      aliases: [...item.aliases].sort(),
      mentions: item.mentions,
      confidence,
    });
  }
  result.sort((left, right) => {
    if (right.mentions !== left.mentions) {
      return right.mentions - left.mentions;
    }
    return right.confidence - left.confidence;
  });
  return result;
}

export async function runTimelineExtractionWorkflow(
  input: TimelineWorkflowInput,
): Promise<TimelineWorkflowOutput> {
  const sourceText = normalizeWhitespace([input.summary ?? "", input.content].filter(Boolean).join("\n"));
  const sentences = splitSentences(sourceText);
  const entityAggregate = buildEntityAggregate(sentences);

  // 这里保持“确定性启发式”，避免模型随机性影响事件追踪。
  const events: TimelineEventCandidate[] = [];
  let matchedSentenceCount = 0;

  for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex += 1) {
    const sentence = sentences[sentenceIndex];
    const matchedRules = pickMatchedRules(sentence);
    if (matchedRules.length === 0) {
      continue;
    }
    matchedSentenceCount += 1;

    const mentions = extractEntityMentions(sentence);
    const normalizedMentions = new Map<string, string>();
    for (const mention of mentions) {
      const normalized = normalizeEntityName(mention);
      normalizedMentions.set(normalized, mention);
      const existing = entityAggregate.get(normalized);
      if (existing) {
        existing.eventMentions += 1;
      } else {
        entityAggregate.set(normalized, {
          name: mention,
          aliases: new Set([mention]),
          mentions: 1,
          eventMentions: 1,
        });
      }
    }

    const entityNames = [...normalizedMentions.values()].slice(0, 4);
    for (const rule of matchedRules) {
      if (events.length >= MAX_EVENT_PER_CHAPTER) {
        break;
      }

      const confidence = calculateEventConfidence(rule, sentence, entityNames.length);
      const fingerprintSeed = normalizeFingerprintText(
        `${input.chapterId}|${sentenceIndex}|${rule.eventType}|${sentence}`,
      );

      events.push({
        fingerprint: `fp_${hashText(fingerprintSeed)}`,
        chapterId: input.chapterId,
        chapterNo: input.chapterNo,
        sentenceIndex,
        eventType: rule.eventType,
        title: buildEventTitle(entityNames, rule.actionLabel),
        description: sentence,
        entityNames,
        confidence,
        status: confidence < LOW_CONFIDENCE_THRESHOLD ? "pending_review" : "auto",
        evidence: sentence,
      });
    }
  }

  // 事件已抽取后再生成实体清单，确保“事件参与者”被纳入候选实体。
  const entities = buildEntityCandidates(entityAggregate);

  return {
    workflow: "timeline.extract.v1",
    entities,
    events,
    diagnostics: {
      sentenceCount: sentences.length,
      matchedSentenceCount,
      pendingReviewThreshold: LOW_CONFIDENCE_THRESHOLD,
      generatedAt: new Date().toISOString(),
    },
  };
}
