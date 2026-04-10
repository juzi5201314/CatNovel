'use client';

import { useEffect, useMemo, useState } from 'react';

import type { BootstrapPayload } from '@/lib/contracts/bootstrap';
import type {
  BookMetadataRecord,
  SettingNodeType,
  WorkspaceCollections,
} from '@/lib/contracts/workspace';
import type { SupportedLocale } from '@/lib/i18n/messages';

import { AiSidebar } from '../ai/ai-sidebar';
import { EditorPanel } from '../editor/editor-panel';
import { OnboardingCard } from '../onboarding/onboarding-card';
import { SettingsPanel } from '../settings/settings-panel';
import { SnapshotPanel } from '../snapshots/snapshot-panel';
import { resolveMessages } from '../../lib/i18n/messages';
import { HelpPanel } from './help-panel';
import { SidebarNav } from './sidebar-nav';
import {
  parseChapterText,
  parseSettingSummary,
  serializeChapterText,
  serializeSettingSummary,
} from './workspace-data';
import { WorkspaceHeader } from './workspace-header';
import { WorkflowStrip } from './workflow-strip';

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as T;

  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  return payload;
}

async function readEventStream(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) {
    return '';
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let output = '';

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const eventChunk of events) {
      const lines = eventChunk.split('\n');
      const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
      const dataLine = lines.find((line) => line.startsWith('data:'))?.slice(5).trim();

      if (!event || !dataLine) {
        continue;
      }

      const payload = JSON.parse(dataLine) as { chunk?: string };
      if (event === 'token' && payload.chunk) {
        output += payload.chunk;
      }
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

function deriveChapterSelection(
  collections: WorkspaceCollections,
  preferredId?: string | null,
) {
  return (
    collections.chapters.find((chapter) => chapter.id === preferredId) ??
    collections.chapters[0] ??
    null
  );
}

function deriveNodeSelection(
  collections: WorkspaceCollections,
  preferredId?: string | null,
) {
  return (
    collections.settingsNodes.find((node) => node.id === preferredId) ??
    collections.settingsNodes[0] ??
    null
  );
}

function deriveSessionSelection(
  collections: WorkspaceCollections,
  preferredId?: string | null,
) {
  return (
    collections.chatSessions.find((session) => session.id === preferredId) ??
    collections.chatSessions[0] ??
    null
  );
}

function deriveProfileSelection(
  collections: WorkspaceCollections,
  preferredId?: string | null,
) {
  return (
    collections.providerProfiles.find((profile) => profile.id === preferredId) ??
    collections.providerProfiles.find((profile) => profile.enabled) ??
    collections.providerProfiles[0] ??
    null
  );
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
  const [locale, setLocale] = useState<SupportedLocale>(
    initialBootstrap.workspace.locale,
  );
  const [activeWorkId, setActiveWorkId] = useState(
    initialCollections.activeWorkId ?? initialBootstrap.workspace.workId,
  );
  const [activeChapterId, setActiveChapterId] = useState(initialChapter?.id ?? null);
  const [activeNodeId, setActiveNodeId] = useState(initialNode?.id ?? null);
  const [activeSessionId, setActiveSessionId] = useState(initialSession?.id ?? null);
  const [selectedProfileId, setSelectedProfileId] = useState(initialProfile?.id ?? null);
  const [editorModes, setEditorModes] = useState({
    slash: true,
    bubble: true,
    highlight: true,
    pageBreak: false,
  });
  const [workDraftTitle, setWorkDraftTitle] = useState('');
  const [volumeDraftTitle, setVolumeDraftTitle] = useState('');
  const [chapterDraftTitle, setChapterDraftTitle] = useState('');
  const [selectedChapterTitle, setSelectedChapterTitle] = useState(
    initialChapter?.title ?? '',
  );
  const [editorBody, setEditorBody] = useState(
    initialChapter ? parseChapterText(initialChapter.bodyJson) : '',
  );
  const [saveState, setSaveState] = useState('idle');
  const [metadataDraft, setMetadataDraft] = useState<BookMetadataRecord>(
    initialCollections.bookMetadata ?? emptyBookMetadata,
  );
  const [draftNodeTitle, setDraftNodeTitle] = useState('');
  const [draftNodeType, setDraftNodeType] = useState<SettingNodeType>('character');
  const [activeNodeTitle, setActiveNodeTitle] = useState(initialNode?.title ?? '');
  const [activeNodeSummary, setActiveNodeSummary] = useState(
    initialNode ? parseSettingSummary(initialNode.payloadJson) : '',
  );
  const [modelDraft, setModelDraft] = useState({
    label: '',
    endpoint: '',
    models: '',
  });
  const [sessionDraftTitle, setSessionDraftTitle] = useState('');
  const [freeChatPrompt, setFreeChatPrompt] = useState('');
  const [pendingGhostText, setPendingGhostText] = useState('');
  const [snapshotDraftLabel, setSnapshotDraftLabel] = useState('Draft checkpoint');
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [auditLog, setAuditLog] = useState<string[]>([]);

  const copy = resolveMessages(locale);
  const activeWork =
    collections.works.find((work) => work.id === activeWorkId) ?? collections.works[0] ?? null;
  const activeChapter = deriveChapterSelection(collections, activeChapterId);
  const activeNode = deriveNodeSelection(collections, activeNodeId);
  const activeProfile = deriveProfileSelection(collections, selectedProfileId);

  const aiContextSettings = useMemo(
    () =>
      collections.settingsNodes.map((node) =>
        `${node.title}\n${parseSettingSummary(node.payloadJson)}`,
      ),
    [collections.settingsNodes],
  );

  async function refreshWorkspace(nextWorkId?: string, nextSessionId?: string) {
    const search = new URLSearchParams();
    if (nextWorkId) {
      search.set('workId', nextWorkId);
    }
    if (nextSessionId) {
      search.set('sessionId', nextSessionId);
    }

    const payload = await readJson<{
      bootstrap: BootstrapPayload;
      collections: WorkspaceCollections;
    }>(await fetch(`/api/bootstrap?${search.toString()}`, { cache: 'no-store' }));
    const resolvedWorkId =
      nextWorkId ??
      payload.collections.activeWorkId ??
      payload.bootstrap.workspace.workId;
    const resolvedChapter = deriveChapterSelection(
      payload.collections,
      activeChapterId,
    );
    const resolvedNode = deriveNodeSelection(payload.collections, activeNodeId);
    const resolvedSession = deriveSessionSelection(
      payload.collections,
      nextSessionId ?? activeSessionId,
    );
    const resolvedProfile = deriveProfileSelection(
      payload.collections,
      selectedProfileId,
    );

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
    setActiveNodeSummary(
      resolvedNode ? parseSettingSummary(resolvedNode.payloadJson) : '',
    );
  }

  async function mutateWorkspace(
    payload: Record<string, unknown>,
    options: {
      preserveEditor?: boolean;
      chapterId?: string | null;
      nodeId?: string | null;
      sessionId?: string | null;
      profileId?: string | null;
    } = {},
  ) {
    const result = await readJson<{
      ok: boolean;
      result: Record<string, unknown>;
      collections: WorkspaceCollections;
      bootstrap: BootstrapPayload;
    }>(
      await fetch('/api/bootstrap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          currentWorkId: activeWorkId,
          currentSessionId: activeSessionId,
        }),
      }),
    );

    const resolvedWorkId =
      activeWorkId ??
      result.collections.activeWorkId ??
      initialBootstrap.workspace.workId;
    const resolvedChapter = deriveChapterSelection(
      result.collections,
      options.chapterId ?? activeChapterId,
    );
    const resolvedNode = deriveNodeSelection(
      result.collections,
      options.nodeId ?? activeNodeId,
    );
    const resolvedSession = deriveSessionSelection(
      result.collections,
      options.sessionId ?? activeSessionId,
    );
    const resolvedProfile = deriveProfileSelection(
      result.collections,
      options.profileId ?? selectedProfileId,
    );

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
      setActiveNodeSummary(
        resolvedNode ? parseSettingSummary(resolvedNode.payloadJson) : '',
      );
    }

    return result;
  }

  async function refreshSnapshots(workId?: string) {
    const query = workId ? `?workId=${workId}` : '';
    const payload = await readJson<{
      list: Array<{ id: string; label: string; createdAt: string }>;
    }>(await fetch(`/api/snapshots${query}`, { cache: 'no-store' }));
    setSnapshots(payload.list);
  }

  useEffect(() => {
    if (!activeChapter) {
      return;
    }

    const canonicalText = parseChapterText(activeChapter.bodyJson);
    if (
      selectedChapterTitle === activeChapter.title &&
      editorBody === canonicalText
    ) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setSaveState('autosaving');
      try {
        const result = await readJson<{
          ok: boolean;
          result: Record<string, unknown>;
          collections: WorkspaceCollections;
          bootstrap: BootstrapPayload;
        }>(
          await fetch('/api/bootstrap', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              action: 'autosave-chapter',
              chapterId: activeChapter.id,
              title: selectedChapterTitle,
              bodyJson: serializeChapterText(editorBody),
              currentWorkId: activeWorkId,
              currentSessionId: activeSessionId,
            }),
          }),
        );

        const resolvedWorkId =
          activeWorkId ??
          result.collections.activeWorkId ??
          initialBootstrap.workspace.workId;
        const resolvedChapter = deriveChapterSelection(
          result.collections,
          activeChapter.id,
        );
        const resolvedNode = deriveNodeSelection(result.collections, activeNodeId);
        const resolvedSession = deriveSessionSelection(
          result.collections,
          activeSessionId,
        );
        const resolvedProfile = deriveProfileSelection(
          result.collections,
          selectedProfileId,
        );

        setCollections(result.collections);
        setLocale(result.bootstrap.workspace.locale);
        setActiveWorkId(resolvedWorkId);
        setActiveChapterId(resolvedChapter?.id ?? null);
        setActiveNodeId(resolvedNode?.id ?? null);
        setActiveSessionId(resolvedSession?.id ?? null);
        setSelectedProfileId(resolvedProfile?.id ?? null);
        setMetadataDraft(result.collections.bookMetadata ?? emptyBookMetadata);
        setSaveState('saved');
      } catch (error) {
        setSaveState(error instanceof Error ? error.message : 'autosave failed');
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [
    activeChapter,
    activeWorkId,
    activeNodeId,
    activeSessionId,
    editorBody,
    initialBootstrap.workspace.workId,
    selectedChapterTitle,
    selectedProfileId,
  ]);

  async function handleCreateWork() {
    const title = workDraftTitle.trim();
    if (!title) return;
    const result = await mutateWorkspace({
      action: 'create-work',
      title,
      locale,
      synopsis: '',
    });
    const workId = (result.result.work as { id: string }).id;
    setWorkDraftTitle('');
    await refreshWorkspace(workId);
    await refreshSnapshots(workId);
  }

  async function handleCreateVolume() {
    if (!activeWorkId || !volumeDraftTitle.trim()) return;
    await mutateWorkspace({
      action: 'create-volume',
      workId: activeWorkId,
      title: volumeDraftTitle,
    });
    setVolumeDraftTitle('');
  }

  async function handleCreateChapter() {
    if (!activeWorkId || !chapterDraftTitle.trim()) return;
    const targetVolume = collections.volumes[0];
    if (!targetVolume) return;
    const result = await mutateWorkspace({
      action: 'create-chapter',
      workId: activeWorkId,
      volumeId: targetVolume.id,
      title: chapterDraftTitle,
      bodyJson: serializeChapterText(''),
    });
    const chapterId = (result.result.chapter as { id: string }).id;
    setChapterDraftTitle('');
    setActiveChapterId(chapterId);
  }

  async function handleSwitchWork(workId: string) {
    await refreshWorkspace(workId);
    await refreshSnapshots(workId);
  }

  async function handleSwitchLocale(nextLocale: SupportedLocale) {
    if (!activeWorkId) return;
    setLocale(nextLocale);
    await mutateWorkspace({
      action: 'update-work',
      workId: activeWorkId,
      locale: nextLocale,
    });
  }

  function handleSwitchChapter(chapterId: string) {
    const chapter = collections.chapters.find((entry) => entry.id === chapterId);
    if (!chapter) return;
    setActiveChapterId(chapterId);
    setSelectedChapterTitle(chapter.title);
    setEditorBody(parseChapterText(chapter.bodyJson));
    setPendingGhostText('');
  }

  function handleSwitchNode(nodeId: string) {
    const node = collections.settingsNodes.find((entry) => entry.id === nodeId);
    if (!node) return;
    setActiveNodeId(nodeId);
    setActiveNodeTitle(node.title);
    setActiveNodeSummary(parseSettingSummary(node.payloadJson));
  }

  async function handleCreateSettingNode() {
    if (!activeWorkId || !draftNodeTitle.trim()) return;
    const result = await mutateWorkspace({
      action: 'create-setting-node',
      workId: activeWorkId,
      nodeType: draftNodeType,
      title: draftNodeTitle,
      payloadJson: serializeSettingSummary(''),
    });
    const nodeId = (result.result.settingNode as { id: string }).id;
    setDraftNodeTitle('');
    setActiveNodeId(nodeId);
  }

  async function handleSaveActiveNode() {
    if (!activeNode) return;
    await mutateWorkspace({
      action: 'update-setting-node',
      nodeId: activeNode.id,
      title: activeNodeTitle,
      payloadJson: serializeSettingSummary(activeNodeSummary),
    });
  }

  async function handleDeleteActiveNode() {
    if (!activeNode) return;
    await mutateWorkspace({
      action: 'delete-setting-node',
      nodeId: activeNode.id,
    });
  }

  async function handleSaveMetadata() {
    if (!activeWorkId) return;
    await mutateWorkspace({
      action: 'update-book-metadata',
      workId: activeWorkId,
      authorName: metadataDraft.authorName,
      premise: metadataDraft.premise,
      targetReaders: metadataDraft.targetReaders,
      serializedStatus: metadataDraft.serializedStatus,
      tagsJson: metadataDraft.tagsJson,
    });
  }

  async function handleRunTask(
    taskClass: '续写' | '改写' | '润色' | '扩写' | 'ghost-text',
  ) {
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
    if (taskClass === 'ghost-text') {
      setPendingGhostText(generatedText);
    } else {
      setEditorBody((current) => `${current}\n\n${generatedText}`.trim());
    }
    setSaveState('ai-complete');
  }

  function handleAcceptGhostText() {
    if (!pendingGhostText) return;
    setEditorBody((current) => `${current}\n\n${pendingGhostText}`.trim());
    setPendingGhostText('');
  }

  function handleRejectGhostText() {
    setPendingGhostText('');
  }

  async function handleCreateProfile() {
    if (!modelDraft.label.trim() || !modelDraft.endpoint.trim() || !modelDraft.models.trim()) {
      return;
    }

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
          modelIds: modelDraft.models
            .split(',')
            .map((entry: string) => entry.trim())
            .filter(Boolean),
        }),
      }),
    );

    setModelDraft({ label: '', endpoint: '', models: '' });
    setAuditLog((current) => [`provider:${payload.profile.id}`, ...current].slice(0, 12));
    await refreshWorkspace(activeWorkId ?? undefined, activeSessionId ?? undefined);
  }

  async function handleCreateChatSession() {
    if (!activeWorkId || !sessionDraftTitle.trim()) return;
    const result = await mutateWorkspace({
      action: 'create-chat-session',
      workId: activeWorkId,
      title: sessionDraftTitle,
    });
    const sessionId = (result.result.session as { id: string }).id;
    setSessionDraftTitle('');
    setActiveSessionId(sessionId);
  }

  async function handleSwitchSession(sessionId: string) {
    await refreshWorkspace(activeWorkId ?? undefined, sessionId);
  }

  async function handleSendFreeChat() {
    if (!activeSessionId || !freeChatPrompt.trim() || !activeProfile) return;

    await mutateWorkspace(
      {
        action: 'append-chat-message',
        sessionId: activeSessionId,
        role: 'user',
        body: freeChatPrompt,
        tokenCount: 0,
      },
      {
        chapterId: activeChapterId,
        nodeId: activeNodeId,
        sessionId: activeSessionId,
        profileId: selectedProfileId,
        preserveEditor: true,
      },
    );

    const response = await readJson<{
      output: string;
      tokenUsage: { totalTokens: number };
    }>(
      await fetch('/api/ai', {
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
      }),
    );

    await mutateWorkspace(
      {
        action: 'append-chat-message',
        sessionId: activeSessionId,
        role: 'assistant',
        body: response.output,
        tokenCount: response.tokenUsage.totalTokens,
      },
      {
        chapterId: activeChapterId,
        nodeId: activeNodeId,
        sessionId: activeSessionId,
        profileId: selectedProfileId,
        preserveEditor: true,
      },
    );

    setFreeChatPrompt('');
  }

  async function handleCreateSnapshot() {
    if (!activeWorkId) return;
    await readJson(
      await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workId: activeWorkId,
          label: snapshotDraftLabel,
        }),
      }),
    );
    setAuditLog((current) => [`snapshot:create:${snapshotDraftLabel}`, ...current].slice(0, 12));
    await refreshSnapshots(activeWorkId);
  }

  async function handleRestoreSnapshot(snapshotId: string) {
    await readJson(
      await fetch(`/api/snapshots/${snapshotId}/restore`, {
        method: 'POST',
      }),
    );
    setAuditLog((current) => [`snapshot:restore:${snapshotId}`, ...current].slice(0, 12));
    await refreshWorkspace(activeWorkId ?? undefined, activeSessionId ?? undefined);
    await refreshSnapshots(activeWorkId ?? undefined);
  }

  async function handleDeleteSnapshot(snapshotId: string) {
    await readJson(
      await fetch(`/api/snapshots/${snapshotId}`, {
        method: 'DELETE',
      }),
    );
    setAuditLog((current) => [`snapshot:delete:${snapshotId}`, ...current].slice(0, 12));
    await refreshSnapshots(activeWorkId ?? undefined);
  }

  async function handleExportProject(
    format: 'json' | 'txt' | 'md' | 'docx' | 'epub' | 'pdf',
  ) {
    const payload = await readJson<{
      exportPayload: { fileName: string };
    }>(await fetch(`/api/export/project?format=${format}`));
    setAuditLog((current) => [`project-export:${payload.exportPayload.fileName}`, ...current].slice(0, 12));
  }

  async function handleImportProject() {
    const archivePayload = await readJson<{
      exportPayload: { content: string };
    }>(await fetch('/api/export/project?format=json'));
    const archive = JSON.parse(archivePayload.exportPayload.content) as Record<string, unknown>;

    await readJson(
      await fetch('/api/import/project', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ archive }),
      }),
    );
    setAuditLog((current) => ['project-import:json', ...current].slice(0, 12));
    await refreshWorkspace(activeWorkId ?? undefined, activeSessionId ?? undefined);
    await refreshSnapshots(activeWorkId ?? undefined);
  }

  async function handleExportChapters(
    format: 'txt' | 'md' | 'docx' | 'epub' | 'pdf',
  ) {
    const payload = await readJson<{
      exportPayload: { fileName: string };
    }>(
      await fetch('/api/export/chapters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          format,
          chapters: collections.chapters.map((chapter) => ({
            title: chapter.title,
            content: parseChapterText(chapter.bodyJson),
          })),
        }),
      }),
    );
    setAuditLog((current) => [`chapter-export:${payload.exportPayload.fileName}`, ...current].slice(0, 12));
  }

  async function handleParseImportFile(
    format: 'txt' | 'md' | 'epub' | 'docx' | 'doc' | 'pdf',
  ) {
    const payload = await readJson<{
      parsedDocument: { title: string; format: string };
    }>(
      await fetch('/api/import/parse-file', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileName: `sample.${format}`,
          content: '雨落在旧城的玻璃顶棚上。',
        }),
      }),
    );
    setAuditLog((current) => [`import-parse:${payload.parsedDocument.format}:${payload.parsedDocument.title}`, ...current].slice(0, 12));
  }

  return (
    <main className="workspace-root">
      <div className="workspace-frame">
        <WorkspaceHeader
          activeChapterTitle={activeChapter?.title ?? '—'}
          activeWorkLabel={activeWork?.title ?? 'CatNovel'}
          copy={copy}
          locale={locale}
          onLocaleChange={handleSwitchLocale}
        />

        <div className="workspace-grid">
          <aside className="workspace-column">
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
              onCreateChapter={handleCreateChapter}
              onCreateVolume={handleCreateVolume}
              onCreateWork={handleCreateWork}
              onVolumeTitleChange={setVolumeDraftTitle}
              onWorkChange={handleSwitchWork}
              onWorkTitleChange={setWorkDraftTitle}
              volumes={collections.volumes}
              works={collections.works}
            />
            <OnboardingCard locale={locale} />
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
          </aside>

          <section className="workspace-column">
            <WorkflowStrip locale={locale} />
            <EditorPanel
              chapter={activeChapter}
              body={editorBody}
              copy={copy}
              draftTitle={selectedChapterTitle}
              editorModes={editorModes}
              locale={locale}
              onBodyChange={setEditorBody}
              onTitleChange={setSelectedChapterTitle}
              onToggleMode={(mode) =>
                setEditorModes((current) => ({ ...current, [mode]: !current[mode] }))
              }
              onRunTask={handleRunTask}
              onAcceptGhostText={handleAcceptGhostText}
              onRejectGhostText={handleRejectGhostText}
              pendingGhostText={pendingGhostText}
              saveState={saveState}
            />
          </section>

          <aside className="workspace-column">
            <AiSidebar
              chapterTitle={activeChapter?.title ?? '—'}
              copy={copy}
              freeChatPrompt={freeChatPrompt}
              locale={locale}
              messages={collections.chatMessages}
              modelDraft={modelDraft}
              activeProfileId={selectedProfileId}
              activeSessionId={activeSessionId}
              onCreateProfile={handleCreateProfile}
              onCreateSession={handleCreateChatSession}
              onFreeChatPromptChange={setFreeChatPrompt}
              onModelDraftChange={(field, value) =>
                setModelDraft((current) => ({ ...current, [field]: value }))
              }
              onSelectProfile={setSelectedProfileId}
              onSendFreeChat={handleSendFreeChat}
              onSessionChange={handleSwitchSession}
              onSessionDraftTitleChange={setSessionDraftTitle}
              providers={collections.providerProfiles}
              sessions={collections.chatSessions}
              sessionDraftTitle={sessionDraftTitle}
              workLabel={activeWork?.title ?? '—'}
            />
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
              onCreateNode={handleCreateSettingNode}
              onDeleteNode={handleDeleteActiveNode}
              onDraftNodeTitleChange={setDraftNodeTitle}
              onDraftNodeTypeChange={setDraftNodeType}
              onMetadataChange={(field, value) =>
                setMetadataDraft((current) => ({ ...current, [field]: value }))
              }
              onNodeChange={handleSwitchNode}
              onSaveMetadata={handleSaveMetadata}
              onSaveNode={handleSaveActiveNode}
            />
            <HelpPanel copy={copy} locale={locale} />
          </aside>
        </div>
      </div>
    </main>
  );
}
