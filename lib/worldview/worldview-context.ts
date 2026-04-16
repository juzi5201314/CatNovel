import type { SettingNodeRecord, WorldviewNodeType } from '@/lib/contracts/workspace';
import { parseWorldviewPayload } from './worldview-payload';

export interface WorldviewContextEntry {
  id: string;
  title: string;
  type: WorldviewNodeType;
  content: string;
}

export function serializeWorldviewContext(
  nodes: SettingNodeRecord[]
): WorldviewContextEntry[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return nodes.map((node) => {
    const type = node.nodeType as WorldviewNodeType;
    const payload = parseWorldviewPayload(node.payloadJson);

    let content = '';

    switch (type) {
      case 'group':
        content = payload.note ?? '';
        break;
      case 'entry':
        content = payload.value ?? '';
        break;
    }

    return {
      id: node.id,
      title: node.title,
      type,
      content,
    };
  });
}

export function formatWorldviewContextForAI(
  entries: WorldviewContextEntry[]
): string[] {
  return entries
    .filter((entry) => entry.content.trim().length > 0)
    .map((entry) => {
      switch (entry.type) {
        case 'group':
          return entry.content
            ? `${entry.title}: ${entry.content}`
            : entry.title;
        case 'entry':
          return `${entry.title}: ${entry.content}`;
        default:
          return entry.title;
      }
    });
}

export function buildWorldviewPromptContext(
  nodes: SettingNodeRecord[],
  options: {
    includeGroups?: boolean;
    includeEntries?: boolean;
    maxLength?: number;
  } = {}
): string {
  const {
    includeGroups = true,
    includeEntries = true,
    maxLength = 4000,
  } = options;

  const entries = serializeWorldviewContext(nodes).filter((entry) => {
    switch (entry.type) {
      case 'group':
        return includeGroups;
      case 'entry':
        return includeEntries;
      default:
        return false;
    }
  });

  const formatted = formatWorldviewContextForAI(entries);

  let result = '';
  for (const line of formatted) {
    if (result.length + line.length + 1 > maxLength) {
      break;
    }
    result += (result ? '\n' : '') + line;
  }

  return result;
}
