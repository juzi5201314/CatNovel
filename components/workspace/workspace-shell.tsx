'use client';

import { useCallback, useState } from 'react';

import { AiSidebar } from '../ai/ai-sidebar';
import { EditorPanel } from '../editor/editor-panel';
import { ModelSettingsDialog } from '../settings/model-settings-dialog';
import { SnapshotPanel } from '../snapshots/snapshot-panel';
import { WorldviewDialog } from '../worldview/worldview-dialog';

import type { BootstrapPayload } from '@/lib/contracts/bootstrap';
import type {
  ChapterExportFormat,
  ImportFileFormat,
  ProjectExportFormat,
} from '@/lib/contracts/transfer';
import type {
  ActiveModelSelection,
  WorkspaceCollections,
} from '@/lib/contracts/workspace';
import type { SupportedLocale } from '@/lib/i18n/messages';
import { cx } from '@/lib/design/cx';

import { resolveMessages } from '../../lib/i18n/messages';
import { SidebarNav } from './sidebar-nav';
import { parseChapterText, serializeChapterText } from './workspace-data';
import { WorkspaceHeader } from './workspace-header';
import { useAiSession } from './hooks/use-ai-session';
import { useEditorDraft } from './hooks/use-editor-draft';
import { useWorkspaceUi } from './hooks/use-workspace-ui';
import { readJson } from './workspace-shell-http';
import {
  deriveActiveModel,
  deriveChapterSelection,
  deriveSessionSelection,
} from './workspace-shell-selectors';
import type {
  ExportPayloadResponse,
  ImportParseResponse,
  SnapshotListItem,
  WorkspaceBootstrapResponse,
  WorkspaceMutationOptions,
  WorkspaceMutationResponse,
} from './workspace-shell.types';

type WorkspaceShellProps = {
  initialBootstrap: BootstrapPayload;
  initialCollections: WorkspaceCollections;
  initialSnapshots: SnapshotListItem[];
};

export function WorkspaceShell({
  initialBootstrap,
  initialCollections,
  initialSnapshots,
}: WorkspaceShellProps) {
  const initialChapter = deriveChapterSelection(initialCollections);
  const initialSession = deriveSessionSelection(initialCollections);
  const initialActiveModel = deriveActiveModel(initialCollections, initialCollections.activeModel);

  const [collections, setCollections] = useState(initialCollections);
  const [locale, setLocale] = useState<SupportedLocale>(initialBootstrap.workspace.locale);
  const [activeWorkId, setActiveWorkId] = useState(initialCollections.activeWorkId ?? initialBootstrap.workspace.workId);
  const [activeChapterId, setActiveChapterId] = useState(initialChapter?.id ?? null);
  const [activeSessionId, setActiveSessionId] = useState(initialSession?.id ?? null);
  const [activeModel, setActiveModel] = useState<ActiveModelSelection | null>(initialActiveModel);
  const [workDraftTitle, setWorkDraftTitle] = useState('');
  const [volumeDraftTitle, setVolumeDraftTitle] = useState('');
  const [snapshotDraftLabel, setSnapshotDraftLabel] = useState('Draft checkpoint');
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [auditLog, setAuditLog] = useState<string[]>([]);

  const activeWork = collections.works.find((work) => work.id === activeWorkId) ?? collections.works[0] ?? null;
  const activeChapter = deriveChapterSelection(collections, activeChapterId);
  const copy = resolveMessages(locale);

  const sendWorkspaceMutation = useCallback(async (
    payload: Record<string, unknown>,
    options: WorkspaceMutationOptions = {},
  ) => {
    const payloadSessionId = typeof payload.sessionId === 'string' ? payload.sessionId : null;
    const requestedSessionId = options.sessionId ?? payloadSessionId ?? activeSessionId;
    const response = await readJson<WorkspaceMutationResponse>(await fetch('/api/bootstrap', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        currentWorkId: activeWorkId,
        currentSessionId: requestedSessionId,
      }),
    }));

    const resolvedWorkId = activeWorkId ?? response.collections.activeWorkId ?? initialBootstrap.workspace.workId;
    const resolvedChapter = deriveChapterSelection(response.collections, options.chapterId ?? activeChapterId);
    const resolvedSession = deriveSessionSelection(response.collections, options.sessionId ?? activeSessionId);
    const resolvedActiveModel = deriveActiveModel(response.collections, activeModel ?? response.collections.activeModel);

    setCollections(response.collections);
    setLocale(response.bootstrap.workspace.locale);
    setActiveWorkId(resolvedWorkId);
    setActiveChapterId(resolvedChapter?.id ?? null);
    setActiveSessionId(resolvedSession?.id ?? null);
    setActiveModel(resolvedActiveModel);

    return {
      response,
      resolvedChapter,
    };
  }, [activeChapterId, activeModel, activeSessionId, activeWorkId, initialBootstrap.workspace.workId]);

  const persistWorkspaceMutation = useCallback(async (
    payload: Record<string, unknown>,
    options: WorkspaceMutationOptions = {},
  ) => {
    const { response } = await sendWorkspaceMutation(payload, options);
    return response;
  }, [sendWorkspaceMutation]);

  const editorDraft = useEditorDraft({
    initialChapter,
    activeChapter,
    mutateWorkspace: persistWorkspaceMutation,
  });
  const {
    selectedChapterTitle,
    editorBody,
    saveState,
    pendingGhostText,
    replaceFromChapter,
    handleManualSave,
    handleBodyChange,
    handleTitleChange,
    acceptGhostText,
    rejectGhostText,
  } = editorDraft;

  const mutateWorkspace = useCallback(async (
    payload: Record<string, unknown>,
    options: WorkspaceMutationOptions = {},
  ) => {
    const { response, resolvedChapter } = await sendWorkspaceMutation(payload, options);
    if (!options.preserveEditor) {
      replaceFromChapter(resolvedChapter);
    }
    return response;
  }, [replaceFromChapter, sendWorkspaceMutation]);

  const refreshWorkspace = useCallback(async (nextWorkId?: string, nextSessionId?: string) => {
    const search = new URLSearchParams();
    if (nextWorkId) {
      search.set('workId', nextWorkId);
    }
    if (nextSessionId) {
      search.set('sessionId', nextSessionId);
    }

    const payload = await readJson<WorkspaceBootstrapResponse>(
      await fetch(`/api/bootstrap?${search.toString()}`, { cache: 'no-store' }),
    );
    const resolvedWorkId = nextWorkId ?? payload.collections.activeWorkId ?? payload.bootstrap.workspace.workId;
    const resolvedChapter = deriveChapterSelection(payload.collections, activeChapterId);
    const resolvedSession = deriveSessionSelection(payload.collections, nextSessionId ?? activeSessionId);
    const resolvedActiveModel = deriveActiveModel(payload.collections, activeModel ?? payload.collections.activeModel);

    setCollections(payload.collections);
    setLocale(payload.bootstrap.workspace.locale);
    setActiveWorkId(resolvedWorkId ?? null);
    setActiveChapterId(resolvedChapter?.id ?? null);
    setActiveSessionId(resolvedSession?.id ?? null);
    setActiveModel(resolvedActiveModel);
    replaceFromChapter(resolvedChapter);
  }, [activeChapterId, activeModel, activeSessionId, replaceFromChapter]);

  const refreshSnapshots = useCallback(async (workId?: string) => {
    const query = workId ? `?workId=${workId}` : '';
    const payload = await readJson<{ list: SnapshotListItem[] }>(
      await fetch(`/api/snapshots${query}`, { cache: 'no-store' }),
    );
    setSnapshots(payload.list);
  }, []);

  const handleManualSaveShortcut = useCallback(() => {
    void handleManualSave();
  }, [handleManualSave]);

  const ui = useWorkspaceUi({ onManualSave: handleManualSaveShortcut });
  const {
    isSidebarOpen,
    toggleSidebar,
    rightSidebarTab,
    setAiTab,
    setSnapshotsTab,
    isSettingsOpen,
    openSettings,
    closeSettings,
    isWorldviewOpen,
    openWorldview,
    closeWorldview,
    rightSidebarWidth,
    sidebarRef,
    handleResizeStart,
  } = ui;

  const aiSession = useAiSession({
    activeModel,
    activeSessionId,
    activeWorkId,
    chatMessages: collections.chatMessages,
    chatSessions: collections.chatSessions,
    mutateWorkspace,
    refreshWorkspace,
  });

  const handleSwitchWork = useCallback((workId: string) => {
    void refreshWorkspace(workId);
  }, [refreshWorkspace]);

  const handleSessionChange = useCallback((sessionId: string) => {
    void refreshWorkspace(undefined, sessionId);
  }, [refreshWorkspace]);

  const handleSwitchLocale = useCallback((nextLocale: SupportedLocale) => {
    setLocale(nextLocale);
    void mutateWorkspace({ action: 'update-work', workId: activeWorkId, locale: nextLocale });
  }, [activeWorkId, mutateWorkspace]);

  const handleSwitchChapter = useCallback((chapterId: string) => {
    const chapter = collections.chapters.find((entry) => entry.id === chapterId);
    if (!chapter) {
      return;
    }
    setActiveChapterId(chapterId);
    replaceFromChapter(chapter);
  }, [collections.chapters, replaceFromChapter]);

  const handleCreateChapter = useCallback((volumeId?: string) => {
    const nextVolumeId = volumeId ?? collections.volumes[0]?.id;
    if (!activeWorkId || !nextVolumeId) {
      return;
    }

    const chapterCount = collections.chapters.filter((chapter) => chapter.volumeId === nextVolumeId).length;
    void mutateWorkspace({
      action: 'create-chapter',
      workId: activeWorkId,
      volumeId: nextVolumeId,
      title: `第${chapterCount + 1}章`,
      bodyJson: serializeChapterText(''),
    });
  }, [activeWorkId, collections.chapters, collections.volumes, mutateWorkspace]);

  const handleCreateVolume = useCallback(() => {
    if (!activeWorkId || !volumeDraftTitle.trim()) {
      return;
    }
    void mutateWorkspace({ action: 'create-volume', workId: activeWorkId, title: volumeDraftTitle });
  }, [activeWorkId, mutateWorkspace, volumeDraftTitle]);

  const handleCreateWork = useCallback(() => {
    if (!workDraftTitle.trim()) {
      return;
    }
    void mutateWorkspace({ action: 'create-work', title: workDraftTitle, locale, synopsis: '' });
  }, [locale, mutateWorkspace, workDraftTitle]);

  const handleUpdateWork = useCallback((workId: string, title: string) => {
    void mutateWorkspace({ action: 'update-work', workId, title });
  }, [mutateWorkspace]);

  const handleDeleteWork = useCallback((workId: string) => {
    void mutateWorkspace({ action: 'delete-work', workId });
  }, [mutateWorkspace]);

  const handleUpdateVolume = useCallback((volumeId: string, title: string) => {
    void mutateWorkspace({ action: 'update-volume', volumeId, title });
  }, [mutateWorkspace]);

  const handleDeleteVolume = useCallback((volumeId: string) => {
    void mutateWorkspace({ action: 'delete-volume', volumeId });
  }, [mutateWorkspace]);

  const handleDeleteChapter = useCallback((chapterId: string) => {
    void mutateWorkspace({ action: 'delete-chapter', chapterId });
  }, [mutateWorkspace]);

  const handleUpdateChapter = useCallback((chapterId: string, title: string) => {
    void mutateWorkspace({ action: 'update-chapter', chapterId, title });
  }, [mutateWorkspace]);

  const handleActiveModelChange = useCallback((selection: ActiveModelSelection) => {
    setActiveModel(selection);
    void mutateWorkspace({
      action: 'set-active-model',
      profileId: selection.profileId,
      modelId: selection.modelId,
    }, { preserveEditor: true });
  }, [mutateWorkspace]);

  const handleCreateSnapshot = useCallback(async () => {
    if (!activeWorkId) {
      return;
    }

    await readJson(await fetch('/api/snapshots', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workId: activeWorkId, label: snapshotDraftLabel }),
    }));
    await refreshSnapshots(activeWorkId);
  }, [activeWorkId, refreshSnapshots, snapshotDraftLabel]);

  const handleRestoreSnapshot = useCallback(async (snapshotId: string) => {
    await readJson(await fetch(`/api/snapshots/${snapshotId}/restore`, { method: 'POST' }));
    await refreshWorkspace(activeWorkId ?? undefined, activeSessionId ?? undefined);
    await refreshSnapshots(activeWorkId ?? undefined);
  }, [activeSessionId, activeWorkId, refreshSnapshots, refreshWorkspace]);

  const handleDeleteSnapshot = useCallback(async (snapshotId: string) => {
    await readJson(await fetch(`/api/snapshots/${snapshotId}`, { method: 'DELETE' }));
    await refreshSnapshots(activeWorkId ?? undefined);
  }, [activeWorkId, refreshSnapshots]);

  const handleExportProject = useCallback(async (format: ProjectExportFormat) => {
    const payload = await readJson<ExportPayloadResponse>(await fetch(`/api/export/project?format=${format}`));
    setAuditLog((current) => [`project-export:${payload.exportPayload.fileName}`, ...current].slice(0, 12));
  }, []);

  const handleImportProject = useCallback(async () => {
    const archivePayload = await readJson<ExportPayloadResponse>(await fetch('/api/export/project?format=json'));
    const archive = JSON.parse(archivePayload.exportPayload.content);
    await readJson(await fetch('/api/import/project', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archive }),
    }));
    await refreshWorkspace(activeWorkId ?? undefined, activeSessionId ?? undefined);
    await refreshSnapshots(activeWorkId ?? undefined);
  }, [activeSessionId, activeWorkId, refreshSnapshots, refreshWorkspace]);

  const handleExportChapters = useCallback(async (format: ChapterExportFormat) => {
    const payload = await readJson<ExportPayloadResponse>(await fetch('/api/export/chapters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        format,
        chapters: collections.chapters.map((chapter) => ({
          title: chapter.title,
          content: parseChapterText(chapter.bodyJson),
        })),
      }),
    }));
    setAuditLog((current) => [`chapter-export:${payload.exportPayload.fileName}`, ...current].slice(0, 12));
  }, [collections.chapters]);

  const handleParseImportFile = useCallback(async (format: ImportFileFormat) => {
    const payload = await readJson<ImportParseResponse>(await fetch('/api/import/parse-file', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: `sample.${format}`, content: '雨落在旧城的玻璃顶棚上。' }),
    }));
    setAuditLog((current) => [`import-parse:${payload.parsedDocument.format}`, ...current].slice(0, 12));
  }, []);

  const handleRefreshProviders = useCallback(() => {
    void refreshWorkspace(activeWorkId ?? undefined, activeSessionId ?? undefined);
  }, [activeSessionId, activeWorkId, refreshWorkspace]);

  const handleWorldviewMutate = useCallback(async (action: string, payload: Record<string, unknown>) => {
    return await mutateWorkspace({ action, ...payload }, { preserveEditor: true });
  }, [mutateWorkspace]);

  return (
    <main className="app-shell">
      <div>
        <WorkspaceHeader
          activeChapterTitle={activeChapter?.title ?? '—'}
          activeModel={activeModel}
          activeWorkLabel={activeWork?.title ?? 'CatNovel'}
          copy={copy}
          locale={locale}
          onLocaleChange={handleSwitchLocale}
          onOpenModelSelector={openSettings}
          providers={collections.providerProfiles}
        />
      </div>

      <div className="app-main">
        <aside
          className={cx(
            'app-sidebar sidebar-transition overflow-hidden',
            isSidebarOpen ? 'w-[240px] opacity-100' : 'w-0 opacity-0 border-none',
          )}
        >
          <div className="w-[240px] h-full">
            <SidebarNav
              activeChapterId={activeChapterId ?? ''}
              activeModel={activeModel}
              activeWorkId={activeWorkId ?? ''}
              chapters={collections.chapters}
              copy={copy}
              draftVolumeTitle={volumeDraftTitle}
              draftWorkTitle={workDraftTitle}
              onChapterChangeAction={handleSwitchChapter}
              onCreateChapterAction={handleCreateChapter}
              onCreateVolumeAction={handleCreateVolume}
              onCreateWorkAction={handleCreateWork}
              onUpdateWorkAction={handleUpdateWork}
              onDeleteWorkAction={handleDeleteWork}
              onUpdateVolumeAction={handleUpdateVolume}
              onDeleteVolumeAction={handleDeleteVolume}
              onDeleteChapterAction={handleDeleteChapter}
              onUpdateChapterAction={handleUpdateChapter}
              onOpenSettingsAction={openSettings}
              onOpenWorldviewAction={openWorldview}
              onVolumeTitleChangeAction={setVolumeDraftTitle}
              onWorkChangeAction={handleSwitchWork}
              onWorkTitleChangeAction={setWorkDraftTitle}
              providers={collections.providerProfiles}
              volumes={collections.volumes}
              works={collections.works}
            />
          </div>
        </aside>

        <div className="app-content relative">
          <EditorPanel
            chapter={activeChapter}
            body={editorBody}
            draftTitle={selectedChapterTitle}
            isSidebarOpen={isSidebarOpen}
            onBodyChange={handleBodyChange}
            onTitleChange={handleTitleChange}
            onAcceptGhostText={acceptGhostText}
            onRejectGhostText={rejectGhostText}
            onToggleSidebar={toggleSidebar}
            pendingGhostText={pendingGhostText}
            saveState={saveState}
          />
        </div>

        <aside
          ref={sidebarRef}
          className="app-aside flex flex-col sidebar-transition relative"
          style={{ width: rightSidebarWidth }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-muted active:bg-muted-foreground/20 z-50 flex items-center justify-center group"
            onMouseDown={handleResizeStart}
            title="拖动调整宽度"
          >
            <div className="w-px h-8 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/50" />
          </div>
          <div className="flex border-b" role="tablist">
            <button
              role="tab"
              aria-selected={rightSidebarTab === 'ai'}
              className={cx(
                'flex-1 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                rightSidebarTab === 'ai' ? 'bg-background border-b-2 border-primary' : 'bg-muted/50 text-muted-foreground',
              )}
              onClick={setAiTab}
            >
              AI
            </button>

            <button
              role="tab"
              aria-selected={rightSidebarTab === 'snapshots'}
              className={cx(
                'flex-1 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                rightSidebarTab === 'snapshots' ? 'bg-background border-b-2 border-primary' : 'bg-muted/50 text-muted-foreground',
              )}
              onClick={setSnapshotsTab}
            >
              Snapshots
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {rightSidebarTab === 'ai' && (
              <AiSidebar
                messages={collections.chatMessages}
                activeModel={activeModel}
                activeSessionId={activeSessionId}
                draftPrompt={aiSession.freeChatPrompt}
                retryingMessageId={aiSession.retryingMessageId}
                askUserQuestions={aiSession.askUserQuestions}
                activeAskUserId={aiSession.activeAskUserId}
                isSubmittingAskUser={aiSession.isSubmittingAskUser}
                onOpenSettings={openSettings}
                onCreateSession={aiSession.handleCreateSession}
                onDeleteSession={aiSession.handleDeleteSession}
                onSessionChange={handleSessionChange}
                onDraftPromptChange={aiSession.setFreeChatPrompt}
                onSendPrompt={aiSession.handleSendPrompt}
                onAbort={aiSession.handleAbort}
                onRetryMessage={aiSession.handleRetryMessage}
                onDeleteMessage={aiSession.handleDeleteMessage}
                onSwitchRetryVersion={aiSession.handleSwitchRetryVersion}
                onAskUserQuestionChange={aiSession.handleAskUserQuestionChange}
                onAskUserResponseChange={aiSession.handleAskUserResponseChange}
                onAskUserMultiSelectChange={aiSession.handleAskUserMultiSelectChange}
                onAskUserOtherInputChange={aiSession.handleAskUserOtherInputChange}
                onSubmitSingleAskUser={aiSession.submitSingleAskUserResponse}
                onSubmitAllAskUsers={aiSession.submitAllAskUserResponses}
                providers={collections.providerProfiles}
                sessions={collections.chatSessions}
                agentStatus={aiSession.agentStatus}
                activeToolName={aiSession.activeToolName}
                streamingMessage={aiSession.streamingMessage}
                toolCalls={aiSession.toolCalls}
              />
            )}
            {rightSidebarTab === 'snapshots' && (
              <SnapshotPanel
                snapshots={snapshots}
                draftLabel={snapshotDraftLabel}
                auditLog={auditLog}
                onDraftLabelChange={setSnapshotDraftLabel}
                onCreateSnapshot={handleCreateSnapshot}
                onRestoreSnapshot={handleRestoreSnapshot}
                onDeleteSnapshot={handleDeleteSnapshot}
                onExportProject={handleExportProject}
                onImportProject={handleImportProject}
                onExportChapters={handleExportChapters}
                onParseImportFile={handleParseImportFile}
              />
            )}
          </div>
        </aside>
      </div>

      {isSettingsOpen && (
        <ModelSettingsDialog
          copy={copy}
          providers={collections.providerProfiles}
          activeModel={activeModel}
          onActiveModelChangeAction={handleActiveModelChange}
          onProvidersChangeAction={handleRefreshProviders}
          onCloseAction={closeSettings}
        />
      )}
      {isWorldviewOpen && (
        <WorldviewDialog
          copy={copy}
          workId={activeWorkId ?? ''}
          nodes={collections.settingsNodes}
          onClose={closeWorldview}
          onMutate={handleWorldviewMutate}
        />
      )}
    </main>
  );
}
