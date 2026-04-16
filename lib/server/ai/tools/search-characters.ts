import { Type, type Static } from '@sinclair/typebox';

import { listSettingsNodes } from '../../repositories/settings-repository.ts';

import type { ToolDefinition, ToolHandler } from './types.ts';

type CharacterMatch = {
  id: string;
  title: string;
  summary: string;
  updatedAt: string;
};

export const SearchCharactersSchema = Type.Object({
  query: Type.String({ minLength: 1, description: 'Name or keyword to search within character records.' }),
  workId: Type.String({ minLength: 1, description: 'The work identifier that owns the characters.' }),
});

export type SearchCharactersParams = Static<typeof SearchCharactersSchema>;

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase();
}

function readCharacterSummary(payloadJson: string) {
  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    const summaryCandidates = [
      parsed.summary,
      parsed.note,
      parsed.value,
      parsed.description,
      parsed.bio,
      parsed.profile,
    ];

    for (const candidate of summaryCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return JSON.stringify(parsed);
  } catch {
    return payloadJson.trim();
  }
}

function filterCharacterMatches(workId: string, query: string): CharacterMatch[] {
  const normalizedQuery = normalizeSearchText(query);

  return listSettingsNodes(workId)
    .filter((node) => node.nodeType === 'character')
    .map((node) => {
      const summary = readCharacterSummary(node.payloadJson);
      return {
        id: node.id,
        title: node.title,
        summary,
        updatedAt: node.updatedAt,
      };
    })
    .filter((character) => {
      const haystack = `${character.title}\n${character.summary}`.toLocaleLowerCase();
      return haystack.includes(normalizedQuery);
    });
}

const searchCharactersHandler: ToolHandler<SearchCharactersParams> = async ({ query, workId }) => {
  return {
    query,
    workId,
    matches: filterCharacterMatches(workId, query),
  };
};

export const searchCharactersTool: ToolDefinition = {
  name: 'search_characters',
  description: 'Search character records within a work by name or profile details.',
  parameters: SearchCharactersSchema,
  handler: searchCharactersHandler,
};
