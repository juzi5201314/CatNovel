// Worldview node type system - replaces legacy SettingNodeType
// Break from legacy semantic types to structural types

export type WorldviewNodeType = 'group' | 'entry' | 'reference';

export interface WorldviewPayload {
  schemaVersion: 1;
  note?: string;      // For groups: description/summary
  value?: string;     // For entries: the key-value content
  refTarget?: string;   // For references: target node id
}

// Legacy type for migration reference only
export type LegacySettingNodeType =
  | 'character'
  | 'location'
  | 'item'
  | 'world'
  | 'plot'
  | 'rule';

export function createWorldviewPayload(
  type: WorldviewNodeType,
  data: { note?: string; value?: string; refTarget?: string } = {}
): WorldviewPayload {
  const base: WorldviewPayload = { schemaVersion: 1 };

  switch (type) {
    case 'group':
      return { ...base, note: data.note ?? '' };
    case 'entry':
      return { ...base, value: data.value ?? '' };
    case 'reference':
      return { ...base, refTarget: data.refTarget ?? '' };
    default:
      return base;
  }
}

export function parseWorldviewPayload(payloadJson: string): WorldviewPayload {
  try {
    const parsed = JSON.parse(payloadJson) as Partial<WorldviewPayload> & { summary?: string };

    // Migration: legacy "summary" field becomes "note"
    if (parsed.summary !== undefined && parsed.note === undefined) {
      parsed.note = parsed.summary;
    }

    return {
      schemaVersion: 1,
      note: parsed.note ?? '',
      value: parsed.value ?? '',
      refTarget: parsed.refTarget ?? '',
    };
  } catch {
    // Fallback for invalid JSON
    return { schemaVersion: 1, note: payloadJson };
  }
}

export function serializeWorldviewPayload(payload: WorldviewPayload): string {
  // Only serialize non-empty fields to keep JSON clean
  const clean: Partial<WorldviewPayload> = { schemaVersion: 1 };

  if (payload.note) clean.note = payload.note;
  if (payload.value) clean.value = payload.value;
  if (payload.refTarget) clean.refTarget = payload.refTarget;

  return JSON.stringify(clean);
}

// Node type guards
export function isGroup(type: WorldviewNodeType): boolean {
  return type === 'group';
}

export function isEntry(type: WorldviewNodeType): boolean {
  return type === 'entry';
}

export function isReference(type: WorldviewNodeType): boolean {
  return type === 'reference';
}

export function canHaveChildren(type: WorldviewNodeType): boolean {
  return type === 'group';
}

// Type conversion validation
export function canConvertType(
  from: WorldviewNodeType,
  to: WorldviewNodeType,
  hasChildren: boolean
): { valid: boolean; reason?: string } {
  // Cannot convert if would orphan children
  if (hasChildren && to !== 'group') {
    return {
      valid: false,
      reason: 'Cannot convert to non-group type while node has children',
    };
  }

  // All other conversions are valid
  return { valid: true };
}

// Reference resolution helper
export function resolveReference(
  refTargetId: string,
  nodes: Array<{ id: string; title: string }>
): { id: string; title: string } | null {
  const target = nodes.find((n) => n.id === refTargetId);
  return target ? { id: target.id, title: target.title } : null;
}

// AI context serialization
export interface WorldviewContextEntry {
  id: string;
  title: string;
  type: WorldviewNodeType;
  note?: string;
  value?: string;
  refDisplay?: string; // Display name of referenced node
}

export function serializeWorldviewContext(
  nodes: Array<{
    id: string;
    title: string;
    nodeType: WorldviewNodeType;
    payloadJson: string;
  }>
): string[] {
  return nodes.map((node) => {
    const payload = parseWorldviewPayload(node.payloadJson);
    let content = '';

    switch (node.nodeType) {
      case 'group':
        content = payload.note ? `${node.title}\n${payload.note}` : node.title;
        break;
      case 'entry':
        content = payload.value
          ? `${node.title}: ${payload.value}`
          : node.title;
        break;
      case 'reference': {
        const target = resolveReference(payload.refTarget ?? '', nodes);
        content = target
          ? `${node.title} → @${target.title}`
          : `${node.title} → @${payload.refTarget || 'unknown'}`;
        break;
      }
    }

    return content;
  });
}
