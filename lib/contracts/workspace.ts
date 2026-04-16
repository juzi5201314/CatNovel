export type WorkspaceLocale = 'zh' | 'en' | 'ru';

export type ProviderFamily =
  | 'openai-compatible'
  | 'openai-responses'
  | 'gemini-native'
  | 'claude-native'
  | 'custom-endpoint';

export type SettingNodeType =
  | 'character'
  | 'location'
  | 'item'
  | 'world'
  | 'plot'
  | 'rule';

export type WorldviewNodeType = 'group' | 'entry' | 'reference';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface WorkRecord {
  id: string;
  title: string;
  locale: WorkspaceLocale;
  synopsis: string;
  createdAt: string;
  updatedAt: string;
}

export interface VolumeRecord {
  id: string;
  workId: string;
  title: string;
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterRecord {
  id: string;
  workId: string;
  volumeId: string;
  title: string;
  bodyJson: string;
  plaintext: string;
  excerpt: string;
  wordCount: number;
  characterCount: number;
  readingMinutes: number;
  status: string;
  lastAutosavedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettingNodeRecord {
  id: string;
  workId: string;
  parentId: string | null;
  nodeType: SettingNodeType | WorldviewNodeType;
  sortIndex: number;
  title: string;
  payloadJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookMetadataRecord {
  workId: string;
  authorName: string;
  premise: string;
  targetReaders: string;
  serializedStatus: string;
  tagsJson: string;
  updatedAt: string;
}

export interface ProviderProfileRecord {
  id: string;
  workId: string;
  family: ProviderFamily;
  label: string;
  endpoint: string;
  model: string;
  modelIds: string[];
  apiKeyEnv: string;
  apiKey: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSessionRecord {
  id: string;
  workId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: ChatRole;
  body: string;
  tokenCount: number;
  createdAt: string;
}

export interface ActiveModelSelection {
  profileId: string;
  modelId: string;
}

export interface WorkspaceCollections {
  works: WorkRecord[];
  activeWorkId: string | null;
  volumes: VolumeRecord[];
  chapters: ChapterRecord[];
  settingsNodes: SettingNodeRecord[];
  bookMetadata: BookMetadataRecord | null;
  providerProfiles: ProviderProfileRecord[];
  chatSessions: ChatSessionRecord[];
  activeSessionId: string | null;
  chatMessages: ChatMessageRecord[];
  activeModel: ActiveModelSelection | null;
}
