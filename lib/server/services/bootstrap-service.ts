import { getDatabaseStatus } from '../../../db/client.ts';
import { bootstrapPayloadSchema } from '../../contracts/bootstrap.ts';
import { listProviderProfiles } from '../repositories/provider-repository.ts';
import {
  getWorkspaceOverview,
  listWorkspaceChapters,
  listWorkspaceVolumes,
} from '../repositories/workspace-repository.ts';
import { getPersistenceSnapshot } from './workspace-data-service.ts';

export function getBootstrapPayload(workId?: string) {
  const workspace = getWorkspaceOverview(workId);
  const chapters = listWorkspaceChapters(workspace.workId);
  const volumes = listWorkspaceVolumes(workspace.workId);
  const providers = listProviderProfiles(workspace.workId).map((provider) => ({
    id: provider.id,
    label: provider.label,
    family: provider.family,
    enabled: Boolean(provider.enabled),
  }));

  return bootstrapPayloadSchema.parse({
    db: getDatabaseStatus(),
    workspace: {
      workId: workspace.workId,
      workTitle: workspace.title,
      locale: workspace.locale,
      synopsis: workspace.synopsis,
      stats: {
        volumeCount: workspace.volumeCount,
        chapterCount: workspace.chapterCount,
        totalWords: workspace.totalWords,
        totalCharacters: workspace.totalCharacters,
        totalReadingMinutes: workspace.totalReadingMinutes,
        lastAutosavedAt: workspace.lastAutosavedAt,
      },
      volumes,
      chapters,
      providers,
    },
  });
}

export function getBootstrapCollections(workId?: string, sessionId?: string) {
  return getPersistenceSnapshot({ workId, sessionId });
}
