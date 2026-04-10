export interface ContextSelection {
  chapter: string;
  settings: string[];
  summaries: string[];
  manualSelections: string[];
}

export interface ContextPacket {
  chapter: string;
  settingsContext: string;
  summaryContext: string;
  manualContext: string;
  combinedContext: string;
  settingsCount: number;
  summaryCount: number;
  manualSelectionCount: number;
  contextEngineLabel: 'chapter-settings-summaries-manual';
}

export function buildContextPacket(selection: ContextSelection): ContextPacket {
  const settingsContext = selection.settings.join('\n');
  const summaryContext = selection.summaries.join('\n');
  const manualContext = selection.manualSelections.join('\n');
  const combinedContext = [
    selection.chapter,
    settingsContext,
    summaryContext,
    manualContext,
  ]
    .filter(Boolean)
    .join('\n---\n');

  return {
    chapter: selection.chapter,
    settingsContext,
    summaryContext,
    manualContext,
    combinedContext,
    settingsCount: selection.settings.length,
    summaryCount: selection.summaries.length,
    manualSelectionCount: selection.manualSelections.length,
    contextEngineLabel: 'chapter-settings-summaries-manual',
  };
}
