import { AiSidebar } from '../ai/ai-sidebar';
import { EditorPanel } from '../editor/editor-panel';
import { OnboardingCard } from '../onboarding/onboarding-card';
import { SettingsPanel } from '../settings/settings-panel';
import { SnapshotPanel } from '../snapshots/snapshot-panel';
import { HelpPanel } from './help-panel';
import { SidebarNav } from './sidebar-nav';
import { WorkspaceHeader } from './workspace-header';
import { WorkflowStrip } from './workflow-strip';

export function WorkspaceShell() {
  return (
    <main className="workspace-root">
      <div className="workspace-frame">
        <WorkspaceHeader />

        <div className="workspace-grid">
          <aside className="workspace-column">
            <SidebarNav />
            <OnboardingCard />
            <SnapshotPanel />
          </aside>

          <section className="workspace-column">
            <WorkflowStrip />
            <EditorPanel />
          </section>

          <aside className="workspace-column">
            <AiSidebar />
            <SettingsPanel />
            <HelpPanel />
          </aside>
        </div>
      </div>
    </main>
  );
}
