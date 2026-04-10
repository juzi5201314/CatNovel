import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { resolveMessages } from "@/lib/i18n/messages";
import { loadBootstrapPayload } from "@/lib/server/bootstrap";

export default function WorkspacePage() {
  const payload = loadBootstrapPayload();
  const copy = resolveMessages(payload.workspace.locale);

  return <WorkspaceShell copy={copy} payload={payload} />;
}
