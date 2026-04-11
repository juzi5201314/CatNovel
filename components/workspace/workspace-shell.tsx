'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

import type { BootstrapPayload } from '@/lib/contracts/bootstrap';
import type {
  BookMetadataRecord,
  SettingNodeType,
  WorkspaceCollections,
} from '@/lib/contracts/workspace';
import type { SupportedLocale } from '@/lib/i18n/messages';

import { AiSidebar } from '../ai/ai-sidebar';
import { EditorPanel } from '../editor/editor-panel';
import { SettingsPanel } from '../settings/settings-panel';
import { SnapshotPanel } from '../snapshots/snapshot-panel';
import { resolveMessages } from '../../lib/i18n/messages';
import { SidebarNav } from './sidebar-nav';
import {
  parseChapterText,
  parseSettingSummary,
  serializeChapterText,
  serializeSettingSummary,
} from './workspace-data';
import { WorkspaceHeader } from './workspace-header';
import { Button } from '../ui/button';
import { cx } from '@/lib/design/cx';

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as T;
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload;
}

async function readEventStream(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let buffer = '';
  let output = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const eventChunk of events) {
      const lines = eventChunk.split('\n');
      const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
      const dataLine = lines.find((line) => line.startsWith('data:'))?.slice(5).trim();
      if (!event || !dataLine) continue;
      const payload = JSON.parse(dataLine) as { chunk?: string };
      if (event === 'token' && payload.chunk) output += payload.chunk;
    }
  }
  return output;
}

const emptyBookMetadata: BookMetadataRecord = {
  workId: 'work-default',
  authorName: '',
  premise: '',
  targetReaders: '',
  serializedStatus: 'ongoing',
  tagsJson: '[]',
  updatedAt: '',
};

function deriveChapterSelection(collections: WorkspaceCollections, preferredId?: string | null) {
  return collections.chapters.find((chapter) => chapter.id === preferredId) ?? collections.chapters[0] ?? null;
}

function deriveNodeSelection(collections: WorkspaceCollections, preferredId?: string | null) {
  return collections.settingsNodes.find((node) => node.id === preferredId) ?? collections.settingsNodes[0] ?? null;
}

function deriveSessionSelection(collections: WorkspaceCollections, preferredId?: string | null) {
  return collections.chatSessions.find((session) => session.id === preferredId) ?? collections.chatSessions[0] ?? null;
}

function deriveProfileSelection(collections: WorkspaceCollections, preferredId?: string | null) {
  return collections.providerProfiles.find((profile) => profile.id === preferredId) ?? collections.providerProfiles.find((profile) => profile.enabled) ?? collections.providerProfiles[0] ?? null;
}

export function WorkspaceShell({
  initialBootstrap,
  initialCollections,
  initialSnapshots,
}: {
  initialBootstrap: BootstrapPayload;
  initialCollections: WorkspaceCollections;
  initialSnapshots: Array<{ id: string; label: string; createdAt: string }>;
}) {
  const initialChapter = deriveChapterSelection(initialCollections);
  const initialNode = deriveNodeSelection(initialCollections);
  const initialSession = deriveSessionSelection(initialCollections);
  const initialProfile = deriveProfileSelection(initialCollections);

  const [collections, setCollections] = useState(initialCollections);
  const [locale, setLocale] = useState<SupportedLocale>(initialBootstrap.workspace.locale);
  const [activeWorkId, setActiveWorkId] = useState(initialCollections.activeWorkId ?? initialBootstrap.workspace.workId);
  const [activeChapterId, setActiveChapterId] = useState(initialChapter?.id ?? null);
  const [activeNodeId, setActiveNodeId] = useState(initialNode?.id ?? null);
  const [activeSessionId, setActiveSessionId] = useState(initialSession?.id ?? null);
  const [selectedProfileId, setSelectedProfileId] = useState(initialProfile?.id ?? null);
  const [rightSidebarTab, setRightSidebarTab] = useState<'ai' | 'settings' | 'snapshots'>('ai');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFocusActive, setIsFocusActive] = useState(false);
  
  const [editorModes, setEditorModes] = useState({ slash: true, bubble: true, highlight: true, pageBreak: false });
  const [workDraftTitle, setWorkDraftTitle] = useState('');
  const [volumeDraftTitle, setVolumeDraftTitle] = useState('');
  const [chapterDraftTitle, setChapterDraftTitle] = useState('');
  const [selectedChapterTitle, setSelectedChapterTitle] = useState(initialChapter?.title ?? '');
  const [editorBody, setEditorBody] = useState(initialChapter ? parseChapterText(initialChapter.bodyJson) : '');
  const [saveState, setSaveState] = useState('idle');
  const [metadataDraft, setMetadataDraft] = useState<BookMetadataRecord>(initialCollections.bookMetadata ?? emptyBookMetadata);
  const [draftNodeTitle, setDraftNodeTitle] = useState('');
  const [draftNodeType, setDraftNodeType] = useState<SettingNodeType>('character');
  const [activeNodeTitle, setActiveNodeTitle] = useState(initialNode?.title ?? '');
  const [activeNodeSummary, setActiveNodeSummary] = useState(initialNode ? parseSettingSummary(initialNode.payloadJson) : '');
  const [modelDraft, setModelDraft] = useState({ label: '', endpoint: '', models: '' });
  const [sessionDraftTitle, setSessionDraftTitle] = useState('');
  const [freeChatPrompt, setFreeChatPrompt] = useState('');
  const [pendingGhostText, setPendingGhostText] = useState('');
  const [snapshotDraftLabel, setSnapshotDraftLabel] = useState('Draft checkpoint');
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [auditLog, setAuditLog] = useState<string[]>([]);

  const copy = resolveMessages(locale);
  const activeWork = collections.works.find((work) => work.id === activeWorkId) ?? collections.works[0] ?? null;
  const activeChapter = deriveChapterSelection(collections, activeChapterId);
  const activeNode = deriveNodeSelection(collections, activeNodeId);
  const activeProfile = deriveProfileSelection(collections, selectedProfileId);

  const aiContextSettings = useMemo(
    () => collections.settingsNodes.map((node) => `${node.title}\n${parseSettingSummary(node.payloadJson)}`),
    [collections.settingsNodes],
  );

  useEffect(() => {
    if (!isFocusActive) return;
    const timer = setTimeout(() => setIsFocusActive(false), 3000);
    return () => clearTimeout(timer);
  }, [isFocusActive]);

  const handleActivity = () => setIsFocusActive(true);

  const handleManualSave = async () => {
    if (!activeChapter) return;
    setSaveState('saving');
    try {
      await mutateWorkspace({
        action: 'autosave-chapter',
        chapterId: activeChapter.id,
        title: selectedChapterTitle,
        bodyJson: serializeChapterText(editorBody),
      }, { preserveEditor: true });
      setSaveState('saved');
      toast.success('Chapter saved manually.');
    } catch (error) {
      setSaveState('failed');
      toast.error('Failed to save. Check connection.');
    }
  };

  useKeyboardShortcuts({
    'mod+s': handleManualSave,
    'mod+b': () => setIsSidebarOpen(prev => !prev),
    'mod+j': () => {
      const tabs: Array<'ai' | 'settings' | 'snapshots'> = ['ai', 'settings', 'snapshots'];
      const nextIndex = (tabs.indexOf(rightSidebarTab) + 1) % tabs.length;
      setRightSidebarTab(tabs[nextIndex]);
    }
  });

  async function refreshWorkspace(nextWorkId?: string, nextSessionId?: string) {
    const search = new URLSearchParams();
    if (nextWorkId) search.set('workId', nextWorkId);
    if (nextSessionId) search.set('sessionId', nextSessionId);

    const payload = await readJson<{ bootstrap: BootstrapPayload; collections: WorkspaceCollections }>(await fetch(`/api/bootstrap?${search.toString()}`, { cache: 'no-store' }));
    const resolvedWorkId = nextWorkId ?? payload.collections.activeWorkId ?? payload.bootstrap.workspace.workId;
    const resolvedChapter = deriveChapterSelection(payload.collections, activeChapterId);
    const resolvedNode = deriveNodeSelection(payload.collections, activeNodeId);
    const resolvedSession = deriveSessionSelection(payload.collections, nextSessionId ?? activeSessionId);
    const resolvedProfile = deriveProfileSelection(payload.collections, selectedProfileId);

    setCollections(payload.collections);
    setLocale(payload.bootstrap.workspace.locale);
    setActiveWorkId(resolvedWorkId ?? null);
    setActiveChapterId(resolvedChapter?.id ?? null);
    setActiveNodeId(resolvedNode?.id ?? null);
    setActiveSessionId(resolvedSession?.id ?? null);
    setSelectedProfileId(resolvedProfile?.id ?? null);
    setMetadataDraft(payload.collections.bookMetadata ?? emptyBookMetadata);
    setSelectedChapterTitle(resolvedChapter?.title ?? '');
    setEditorBody(resolvedChapter ? parseChapterText(resolvedChapter.bodyJson) : '');
    setActiveNodeTitle(resolvedNode?.title ?? '');
    setActiveNodeSummary(resolvedNode ? parseSettingSummary(resolvedNode.payloadJson) : '');
  }

  async function mutateWorkspace(payload: Record<string, unknown>, options: any = {}) {
    const result = await readJson<any>(await fetch('/api/bootstrap', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, currentWorkId: activeWorkId, currentSessionId: activeSessionId }),
    }));

    const resolvedWorkId = activeWorkId ?? result.collections.activeWorkId ?? initialBootstrap.workspace.workId;
    const resolvedChapter = deriveChapterSelection(result.collections, options.chapterId ?? activeChapterId);
    const resolvedNode = deriveNodeSelection(result.collections, options.nodeId ?? activeNodeId);
    const resolvedSession = deriveSessionSelection(result.collections, options.sessionId ?? activeSessionId);
    const resolvedProfile = deriveProfileSelection(result.collections, options.profileId ?? selectedProfileId);

    setCollections(result.collections);
    setLocale(result.bootstrap.workspace.locale);
    setActiveWorkId(resolvedWorkId);
    setActiveChapterId(resolvedChapter?.id ?? null);
    setActiveNodeId(resolvedNode?.id ?? null);
    setActiveSessionId(resolvedSession?.id ?? null);
    setSelectedProfileId(resolvedProfile?.id ?? null);
    setMetadataDraft(result.collections.bookMetadata ?? emptyBookMetadata);

    if (!options.preserveEditor) {
      setSelectedChapterTitle(resolvedChapter?.title ?? '');
      setEditorBody(resolvedChapter ? parseChapterText(resolvedChapter.bodyJson) : '');
      setActiveNodeTitle(resolvedNode?.title ?? '');
      setActiveNodeSummary(resolvedNode ? parseSettingSummary(resolvedNode.payloadJson) : '');
    }
    return result;
  }

  async function refreshSnapshots(workId?: string) {
    const query = workId ? `?workId=${workId}` : '';
    const payload = await readJson<{ list: Array<{ id: string; label: string; createdAt: string }> }>(await fetch(`/api/snapshots${query}`, { cache: 'no-store' }));
    setSnapshots(payload.list);
  }

  async function handleCreateSnapshot() {
    if (!activeWorkId) return;
    await readJson(await fetch('/api/snapshots', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workId: activeWorkId, label: snapshotDraftLabel }),
    }));
    await refreshSnapshots(activeWorkId);
  }

  async function handleRestoreSnapshot(snapshotId: string) {
    await readJson(await fetch(`/api/snapshots/${snapshotId}/restore`, { method: 'POST' }));
    await refreshWorkspace(activeWorkId ?? undefined, activeSessionId ?? undefined);
    await refreshSnapshots(activeWorkId ?? undefined);
  }

  async function handleDeleteSnapshot(snapshotId: string) {
    await readJson(await fetch(`/api/snapshots/${snapshotId}`, { method: 'DELETE' }));
    await refreshSnapshots(activeWorkId ?? undefined);
  }

  async function handleExportProject(format: any) {
    const payload = await readJson<any>(await fetch(`/api/export/project?format=${format}`));
    setAuditLog((current) => [`project-export:${payload.exportPayload.fileName}`, ...current].slice(0, 12));
  }

  async function handleImportProject() {
    const archivePayload = await readJson<any>(await fetch('/api/export/project?format=json'));
    const archive = JSON.parse(archivePayload.exportPayload.content);
    await readJson(await fetch('/api/import/project', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archive }),
    }));
    await refreshWorkspace(activeWorkId ?? undefined, activeSessionId ?? undefined);
    await refreshSnapshots(activeWorkId ?? undefined);
  }

  async function handleExportChapters(format: any) {
    const payload = await readJson<any>(await fetch('/api/export/chapters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ format, chapters: collections.chapters.map((c) => ({ title: c.title, content: parseChapterText(c.bodyJson) })) }),
    }));
    setAuditLog((current) => [`chapter-export:${payload.exportPayload.fileName}`, ...current].slice(0, 12));
  }

  async function handleParseImportFile(format: any) {
    const payload = await readJson<any>(await fetch('/api/import/parse-file', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: `sample.${format}`, content: '雨落在旧城的玻璃顶棚上。' }),
    }));
    setAuditLog((current) => [`import-parse:${payload.parsedDocument.format}`, ...current].slice(0, 12));
  }

  useEffect(() => {
    if (!activeChapter) return;
    const canonicalText = parseChapterText(activeChapter.bodyJson);
    if (selectedChapterTitle === activeChapter.title && editorBody === canonicalText) return;

    const timer = window.setTimeout(async () => {
      setSaveState('autosaving');
      try {
        await mutateWorkspace({
          action: 'autosave-chapter',
          chapterId: activeChapter.id,
          title: selectedChapterTitle,
          bodyJson: serializeChapterText(editorBody),
        }, { preserveEditor: true });
        setSaveState('saved');
      } catch (error) {
        setSaveState('failed');
        toast.error('Autosave failed. Check your connection.', {
          action: {
            label: 'Retry',
            onClick: () => { handleManualSave(); },
          },
        });
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [activeChapter, editorBody, selectedChapterTitle]);

  const handleSwitchWork = (workId: string) => refreshWorkspace(workId);
  const handleSwitchLocale = (nextLocale: SupportedLocale) => {
    setLocale(nextLocale);
    mutateWorkspace({ action: 'update-work', workId: activeWorkId, locale: nextLocale });
  };
  const handleSwitchChapter = (chapterId: string) => {
    const chapter = collections.chapters.find((entry) => entry.id === chapterId);
    if (!chapter) return;
    setActiveChapterId(chapterId);
    setSelectedChapterTitle(chapter.title);
    setEditorBody(parseChapterText(chapter.bodyJson));
    setPendingGhostText('');
  };

  const handleRunTask = async (taskClass: any) => {
    if (!activeProfile || !activeChapter) return;
    setSaveState(`ai:${taskClass}`);
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'generate',
        profileId: activeProfile.id,
        modelId: activeProfile.modelIds[0],
        taskClass,
        prompt: editorBody,
        stream: true,
        chapter: editorBody,
        settings: aiContextSettings,
        summaries: [],
        manualSelections: [activeNodeSummary].filter(Boolean),
      }),
    });
    const generatedText = await readEventStream(response);
    if (taskClass === 'ghost-text') setPendingGhostText(generatedText);
    else setEditorBody((current) => `${current}\n\n${generatedText}`.trim());
    setSaveState('ai-complete');
  };

  return (
    <main className="app-shell">
      <div className={cx("focus-mode-fade", isFocusActive && "focus-mode-dim")}>
        <WorkspaceHeader
          activeChapterTitle={activeChapter?.title ?? '—'}
          activeWorkLabel={activeWork?.title ?? 'CatNovel'}
          copy={copy}
          locale={locale}
          onLocaleChange={handleSwitchLocale}
        />
      </div>

      <div className="app-main">
        <aside 
          className={cx(
            "app-sidebar sidebar-transition overflow-hidden", 
            isSidebarOpen ? "w-[240px] opacity-100" : "w-0 opacity-0 border-none",
            isFocusActive && "focus-mode-dim focus-mode-fade"
          )}
        >
          <div className="w-[240px]">
            <SidebarNav
              activeChapterId={activeChapterId ?? ''}
              activeWorkId={activeWorkId ?? ''}
              chapters={collections.chapters}
              copy={copy}
              draftChapterTitle={chapterDraftTitle}
              draftVolumeTitle={volumeDraftTitle}
              draftWorkTitle={workDraftTitle}
              locale={locale}
              onChapterChange={handleSwitchChapter}
              onChapterTitleChange={setChapterDraftTitle}
              onCreateChapter={() => mutateWorkspace({ action: 'create-chapter', workId: activeWorkId, volumeId: collections.volumes[0]?.id, title: chapterDraftTitle, bodyJson: serializeChapterText('') })}
              onCreateVolume={() => mutateWorkspace({ action: 'create-volume', workId: activeWorkId, title: volumeDraftTitle })}
              onCreateWork={() => mutateWorkspace({ action: 'create-work', title: workDraftTitle, locale, synopsis: '' })}
              onVolumeTitleChange={setVolumeDraftTitle}
              onWorkChange={handleSwitchWork}
              onWorkTitleChange={setWorkDraftTitle}
              volumes={collections.volumes}
              works={collections.works}
            />
          </div>
        </aside>

        <div className="app-content relative">
          <Button 
            variant="ghost" 
            size="sm" 
            className={cx(
              "absolute left-2 top-2 z-20 h-8 w-8 p-0 transition-opacity", 
              isFocusActive && "opacity-0 pointer-events-none"
            )} 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? '←' : '→'}
          </Button>
          
          <EditorPanel
            chapter={activeChapter}
            body={editorBody}
            copy={copy}
            draftTitle={selectedChapterTitle}
            editorModes={editorModes}
            locale={locale}
            onBodyChange={(v) => { setEditorBody(v); handleActivity(); }}
            onTitleChange={(v) => { setSelectedChapterTitle(v); handleActivity(); }}
            onToggleMode={(mode) => setEditorModes((current) => ({ ...current, [mode]: !current[mode] }))}
            onRunTask={handleRunTask}
            onAcceptGhostText={() => { setEditorBody((c) => `${c}\n\n${pendingGhostText}`.trim()); setPendingGhostText(''); }}
            onRejectGhostText={() => setPendingGhostText('')}
            pendingGhostText={pendingGhostText}
            saveState={saveState}
          />
        </div>

        <aside 
          className={cx(
            "app-aside flex flex-col sidebar-transition",
            isFocusActive && "focus-mode-dim focus-mode-fade"
          )}
        >
          <div className="flex border-b" role="tablist">
            <button 
              role="tab"
              aria-selected={rightSidebarTab === 'ai'}
              className={cx("flex-1 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors", rightSidebarTab === 'ai' ? "bg-background border-b-2 border-primary" : "bg-muted/50 text-muted-foreground")}
              onClick={() => setRightSidebarTab('ai')}
            >
              AI
            </button>
            <button 
              role="tab"
              aria-selected={rightSidebarTab === 'settings'}
              className={cx("flex-1 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors", rightSidebarTab === 'settings' ? "bg-background border-b-2 border-primary" : "bg-muted/50 text-muted-foreground")}
              onClick={() => setRightSidebarTab('settings')}
            >
              Settings
            </button>
            <button 
              role="tab"
              aria-selected={rightSidebarTab === 'snapshots'}
              className={cx("flex-1 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors", rightSidebarTab === 'snapshots' ? "bg-background border-b-2 border-primary" : "bg-muted/50 text-muted-foreground")}
              onClick={() => setRightSidebarTab('snapshots')}
            >
              Snapshots
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {rightSidebarTab === 'ai' && (
              <AiSidebar
                chapterTitle={activeChapter?.title ?? '—'}
                copy={copy}
                freeChatPrompt={freeChatPrompt}
                locale={locale}
                messages={collections.chatMessages}
                modelDraft={modelDraft}
                activeProfileId={selectedProfileId}
                activeSessionId={activeSessionId}
                onCreateProfile={async () => {
                  if (!modelDraft.label.trim() || !modelDraft.endpoint.trim() || !modelDraft.models.trim()) return;
                  const payload = await readJson<{ profile: { id: string } }>(
                    await fetch('/api/ai', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({
                        action: 'create-profile',
                        label: modelDraft.label,
                        family: 'custom-endpoint',
                        endpoint: modelDraft.endpoint,
                        apiKey: 'custom-key',
                        modelIds: modelDraft.models.split(',').map((e: string) => e.trim()).filter(Boolean),
                      }),
                    }),
                  );
                  setModelDraft({ label: '', endpoint: '', models: '' });
                  await refreshWorkspace(activeWorkId ?? undefined, activeSessionId ?? undefined);
                }}
                onCreateSession={() => mutateWorkspace({ action: 'create-chat-session', workId: activeWorkId, title: sessionDraftTitle })}
                onFreeChatPromptChange={setFreeChatPrompt}
                onModelDraftChange={(field, value) => setModelDraft((current) => ({ ...current, [field]: value }))}
                onSelectProfile={setSelectedProfileId}
                onSendFreeChat={async () => {
                  if (!activeSessionId || !freeChatPrompt.trim() || !activeProfile) return;
                  await mutateWorkspace({
                    action: 'append-chat-message',
                    sessionId: activeSessionId,
                    role: 'user',
                    body: freeChatPrompt,
                    tokenCount: 0,
                  }, { preserveEditor: true });

                  const response = await readJson<any>(await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      action: 'generate',
                      profileId: activeProfile.id,
                      modelId: activeProfile.modelIds[0],
                      taskClass: '自由对话',
                      prompt: freeChatPrompt,
                      chapter: editorBody,
                      settings: aiContextSettings,
                      summaries: [],
                      manualSelections: [activeNodeSummary].filter(Boolean),
                    }),
                  }));

                  await mutateWorkspace({
                    action: 'append-chat-message',
                    sessionId: activeSessionId,
                    role: 'assistant',
                    body: response.output,
                    tokenCount: response.tokenUsage.totalTokens,
                  }, { preserveEditor: true });
                  setFreeChatPrompt('');
                }}
                onSessionChange={(sid) => refreshWorkspace(undefined, sid)}
                onSessionDraftTitleChange={setSessionDraftTitle}
                providers={collections.providerProfiles}
                sessions={collections.chatSessions}
                sessionDraftTitle={sessionDraftTitle}
                workLabel={activeWork?.title ?? '—'}
              />
            )}
            {rightSidebarTab === 'settings' && (
              <SettingsPanel
                activeNodeId={activeNodeId}
                activeNodeSummary={activeNodeSummary}
                activeNodeTitle={activeNodeTitle}
                copy={copy}
                draftNodeTitle={draftNodeTitle}
                draftNodeType={draftNodeType}
                locale={locale}
                metadata={metadataDraft}
                nodes={collections.settingsNodes}
                onActiveNodeSummaryChange={setActiveNodeSummary}
                onActiveNodeTitleChange={setActiveNodeTitle}
                onCreateNode={() => mutateWorkspace({ action: 'create-setting-node', workId: activeWorkId, nodeType: draftNodeType, title: draftNodeTitle, payloadJson: serializeSettingSummary('') })}
                onDeleteNode={() => mutateWorkspace({ action: 'delete-setting-node', nodeId: activeNode.id })}
                onDraftNodeTitleChange={setDraftNodeTitle}
                onDraftNodeTypeChange={setDraftNodeType}
                onMetadataChange={(field, value) => setMetadataDraft((current) => ({ ...current, [field]: value }))}
                onNodeChange={(nid) => {
                  const node = collections.settingsNodes.find((entry) => entry.id === nid);
                  if (!node) return;
                  setActiveNodeId(nid);
                  setActiveNodeTitle(node.title);
                  setActiveNodeSummary(parseSettingSummary(node.payloadJson));
                }}
                onSaveMetadata={() => mutateWorkspace({ action: 'update-book-metadata', ...metadataDraft, workId: activeWorkId })}
                onSaveNode={() => mutateWorkspace({ action: 'update-setting-node', nodeId: activeNode.id, title: activeNodeTitle, payloadJson: serializeSettingSummary(activeNodeSummary) })}
              />
            )}
            {rightSidebarTab === 'snapshots' && (
              <SnapshotPanel
                locale={locale}
                copy={copy}
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
    </main>
  );
}
