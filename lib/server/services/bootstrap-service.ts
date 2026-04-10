import { getDatabaseStatus } from "@/db/client";
import { bootstrapPayloadSchema } from "@/lib/contracts/bootstrap";
import { listProviderProfiles } from "@/lib/server/repositories/provider-repository";
import {
  getWorkspaceOverview,
  listWorkspaceChapters,
  listWorkspaceVolumes,
} from "@/lib/server/repositories/workspace-repository";

export function getBootstrapPayload() {
  const workspace = getWorkspaceOverview();
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
      volumes,
      chapters,
      providers,
    },
  });
}
