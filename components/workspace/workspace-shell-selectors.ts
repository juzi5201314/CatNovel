import type {
  ActiveModelSelection,
  ChapterRecord,
  ChatSessionRecord,
  WorkspaceCollections,
} from '@/lib/contracts/workspace';

export function deriveChapterSelection(
  collections: WorkspaceCollections,
  preferredId?: string | null,
): ChapterRecord | null {
  return collections.chapters.find((chapter) => chapter.id === preferredId) ?? collections.chapters[0] ?? null;
}

export function deriveSessionSelection(
  collections: WorkspaceCollections,
  preferredId?: string | null,
): ChatSessionRecord | null {
  return collections.chatSessions.find((session) => session.id === preferredId) ?? collections.chatSessions[0] ?? null;
}

export function deriveActiveModel(
  collections: WorkspaceCollections,
  preferred?: ActiveModelSelection | null,
): ActiveModelSelection | null {
  const availableModels = collections.providerProfiles.filter((profile) => profile.enabled && profile.modelIds.length > 0);

  if (availableModels.length === 0) {
    return null;
  }

  if (preferred?.profileId && preferred.modelId) {
    const profile = collections.providerProfiles.find((entry) => entry.id === preferred.profileId);
    if (profile && profile.enabled && profile.modelIds.includes(preferred.modelId)) {
      return preferred;
    }
  }

  return {
    profileId: availableModels[0].id,
    modelId: availableModels[0].modelIds[0],
  };
}
