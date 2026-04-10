'use client';

import { useMemo, useState } from 'react';

import { AiSidebar } from '../ai/ai-sidebar';
import { EditorPanel } from '../editor/editor-panel';
import { OnboardingCard } from '../onboarding/onboarding-card';
import { SettingsPanel } from '../settings/settings-panel';
import { SnapshotPanel } from '../snapshots/snapshot-panel';
import { resolveMessages, type SupportedLocale } from '../../lib/i18n/messages';
import { HelpPanel } from './help-panel';
import { SidebarNav } from './sidebar-nav';
import {
  bookFields,
  chapters,
  settingNodes,
  t,
  works,
} from './workspace-data';
import { WorkspaceHeader } from './workspace-header';
import { WorkflowStrip } from './workflow-strip';

export function WorkspaceShell() {
  const defaultWork = works[0]!;
  const defaultChapter = chapters[0]!;
  const defaultSettingNode = settingNodes[0]!;
  const [locale, setLocale] = useState<SupportedLocale>('zh');
  const [activeWorkId, setActiveWorkId] = useState(defaultWork.id);
  const [activeChapterId, setActiveChapterId] = useState(defaultChapter.id);
  const [activeSettingNodeId, setActiveSettingNodeId] = useState(defaultSettingNode.id);
  const [editorModes, setEditorModes] = useState({
    slash: true,
    bubble: true,
    highlight: true,
    pageBreak: false,
  });

  const copy = resolveMessages(locale);

  const filteredChapters = useMemo(
    () => chapters.filter((chapter) => chapter.workId === activeWorkId),
    [activeWorkId],
  );

  const activeWork = works.find((work) => work.id === activeWorkId) ?? defaultWork;
  const activeChapter =
    filteredChapters.find((chapter) => chapter.id === activeChapterId) ??
    filteredChapters[0] ??
    defaultChapter;
  const activeSettingNode =
    settingNodes.find((node) => node.id === activeSettingNodeId) ?? defaultSettingNode;

  const localizedBookFields = bookFields.map((field) => ({
    key: field.key,
    label: t(locale, field.label),
    value: t(locale, field.value),
  }));

  function updateLocale(nextLocale: SupportedLocale) {
    setLocale(nextLocale);
  }

  function updateWork(workId: string) {
    setActiveWorkId(workId);
    const nextChapter = chapters.find((chapter) => chapter.workId === workId);
    if (nextChapter) {
      setActiveChapterId(nextChapter.id);
    }
  }

  function toggleEditorMode(mode: keyof typeof editorModes) {
    setEditorModes((current) => ({
      ...current,
      [mode]: !current[mode],
    }));
  }

  return (
    <main className="workspace-root">
      <div className="workspace-frame">
        <WorkspaceHeader
          activeChapterTitle={t(locale, activeChapter.title)}
          activeWorkLabel={t(locale, activeWork.label)}
          copy={copy}
          locale={locale}
          onLocaleChange={updateLocale}
        />

        <div className="workspace-grid">
          <aside className="workspace-column">
            <SidebarNav
              activeChapterId={activeChapter.id}
              activeWorkId={activeWork.id}
              chapters={filteredChapters}
              copy={copy}
              locale={locale}
              onChapterChange={setActiveChapterId}
              onWorkChange={updateWork}
              works={works}
            />
            <OnboardingCard locale={locale} />
            <SnapshotPanel chapterTitle={t(locale, activeChapter.title)} copy={copy} locale={locale} />
          </aside>

          <section className="workspace-column">
            <WorkflowStrip locale={locale} />
            <EditorPanel
              chapter={activeChapter}
              copy={copy}
              editorModes={editorModes}
              locale={locale}
              onToggleMode={toggleEditorMode}
            />
          </section>

          <aside className="workspace-column">
            <AiSidebar
              chapterTitle={t(locale, activeChapter.title)}
              copy={copy}
              locale={locale}
              workLabel={t(locale, activeWork.label)}
            />
            <SettingsPanel
              activeNodeHint={t(locale, activeSettingNode.hint)}
              activeNodeId={activeSettingNode.id}
              bookFields={localizedBookFields}
              copy={copy}
              locale={locale}
              nodes={settingNodes}
              onNodeChange={setActiveSettingNodeId}
            />
            <HelpPanel copy={copy} locale={locale} />
          </aside>
        </div>
      </div>
    </main>
  );
}
