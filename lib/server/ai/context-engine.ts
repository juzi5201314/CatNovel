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
  contextEngineLabel: 'chapter-settings-summaries-manual';
}

export function buildContextPacket(selection: ContextSelection): ContextPacket {
  return {
    chapter: selection.chapter,
    settingsContext: selection.settings.join('\n'),
    summaryContext: selection.summaries.join('\n'),
    manualContext: selection.manualSelections.join('\n'),
    contextEngineLabel: 'chapter-settings-summaries-manual',
  };
}
