'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

import type { BootstrapPayload } from '@/lib/contracts/bootstrap';
import type {
  AgentEvent,
  AgentRunStatus,
} from '@/lib/contracts/agent-events';
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

import { AiSidebar } from '../ai/ai-sidebar';
import type { StreamingMessage, ToolCallItem } from '../ai/chat-session-list';
import { EditorPanel } from '../editor/editor-panel';
import { ModelSettingsDialog } from '../settings/model-settings-dialog';
import { SnapshotPanel } from '../snapshots/snapshot-panel';
import { WorldviewDialog } from '../worldview/worldview-dialog';
import { resolveMessages } from '../../lib/i18n/messages';
import { SidebarNav } from './sidebar-nav';
import {
  parseChapterText,
  serializeChapterText,
} from './workspace-data';
import { WorkspaceHeader } from './workspace-header';
import { cx } from '@/lib/design/cx';

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as T;
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload;
}

type WorkspaceBootstrapResponse = {
  bootstrap: BootstrapPayload;
  collections: WorkspaceCollections;
};

type WorkspaceMutationResponse = WorkspaceBootstrapResponse & {
  ok?: boolean;
  result?: unknown;
};

type WorkspaceMutationOptions = {
  preserveEditor?: boolean;
  chapterId?: string | null;
  sessionId?: string | null;
};

type ExportPayloadResponse = {
  exportPayload: {
    format: ProjectExportFormat | ChapterExportFormat;
    fileName: string;
    content: string;
  };
};

type ImportParseResponse = {
  parsedDocument: {
    format: ImportFileFormat;
  };
};

function deriveChapterSelection(collections: WorkspaceCollections, preferredId?: string | null) {
  return collections.chapters.find((chapter) => chapter.id === preferredId) ?? collections.chapters[0] ?? null;
}

function deriveSessionSelection(collections: WorkspaceCollections, preferredId?: string | null) {
  return collections.chatSessions.find((session) => session.id === preferredId) ?? collections.chatSessions[0] ?? null;
}

function deriveActiveModel(collections: WorkspaceCollections, preferred?: ActiveModelSelection | null): ActiveModelSelection | null {
  const availableModels = collections.providerProfiles
    .filter((p) => p.enabled && p.modelIds.length > 0);

  if (availableModels.length === 0) {
    return null;
  }

  if (preferred?.profileId && preferred?.modelId) {
    const profile = collections.providerProfiles.find((p) => p.id === preferred.profileId);
    if (profile && profile.enabled && profile.modelIds.includes(preferred.modelId)) {
      return preferred;
    }
  }

  return { profileId: availableModels[0].id, modelId: availableModels[0].modelIds[0] };
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
const initialSession = deriveSessionSelection(initialCollections);
  const initialActiveModel = deriveActiveModel(initialCollections, initialCollections.activeModel);

  const [collections, setCollections] = useState(initialCollections);
  const [locale, setLocale] = useState<SupportedLocale>(initialBootstrap.workspace.locale);
  const [activeWorkId, setActiveWorkId] = useState(initialCollections.activeWorkId ?? initialBootstrap.workspace.workId);
const [activeChapterId, setActiveChapterId] = useState(initialChapter?.id ?? null);
const [activeSessionId, setActiveSessionId] = useState(initialSession?.id ?? null);
  const [activeModel, setActiveModel] = useState<ActiveModelSelection | null>(initialActiveModel);
const [rightSidebarTab, setRightSidebarTab] = useState<'ai' | 'snapshots'>('ai');
const [isSidebarOpen, setIsSidebarOpen] = useState(true);
const [isSettingsOpen, setIsSettingsOpen] = useState(false);
const [isWorldviewOpen, setIsWorldviewOpen] = useState(false);

  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
  const sidebarRef = useRef<HTMLElement>(null);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(320);
  const rafRef = useRef<number | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = rightSidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [rightSidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        const delta = startXRef.current - e.clientX;
        const newWidth = Math.max(240, Math.min(600, startWidthRef.current + delta));

        if (sidebarRef.current) {
          sidebarRef.current.style.width = `${newWidth}px`;
        }
      });
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      if (sidebarRef.current) {
        const finalWidth = parseInt(sidebarRef.current.style.width, 10);
        setRightSidebarWidth(finalWidth);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const [workDraftTitle, setWorkDraftTitle] = useState('');
  const [volumeDraftTitle, setVolumeDraftTitle] = useState('');
  const [selectedChapterTitle, setSelectedChapterTitle] = useState(initialChapter?.title ?? '');
  const [editorBody, setEditorBody] = useState(initialChapter ? parseChapterText(initialChapter.bodyJson) : '');
  const [saveState, setSaveState] = useState('idle');

  const [freeChatPrompt, setFreeChatPrompt] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentRunStatus>('idle');
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCallItem[]>([]);
  const [pendingGhostText, setPendingGhostText] = useState('');
  const [snapshotDraftLabel, setSnapshotDraftLabel] = useState('Draft checkpoint');
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [auditLog, setAuditLog] = useState<string[]>([]);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [retryVersions, setRetryVersions] = useState<Map<string, { currentIndex: number; versions: string[] }>>(new Map());
  const streamingStartTimeRef = useRef<number | null>(null);
  const streamingTokensRef = useRef(0);
  const latestStreamingTpsRef = useRef(0);

  const copy = resolveMessages(locale);
  const activeWork = collections.works.find((work) => work.id === activeWorkId) ?? collections.works[0] ?? null;
  const activeChapter = deriveChapterSelection(collections, activeChapterId);

  const mutateWorkspace = useCallback(async (
    payload: Record<string, unknown>,
    options: WorkspaceMutationOptions = {},
  ) => {
    const payloadSessionId = typeof payload.sessionId === 'string' ? payload.sessionId : null;
    const requestedSessionId = options.sessionId ?? payloadSessionId ?? activeSessionId;
    const result = await readJson<WorkspaceMutationResponse>(await fetch('/api/bootstrap', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, currentWorkId: activeWorkId, currentSessionId: requestedSessionId }),
    }));

    const resolvedWorkId = activeWorkId ?? result.collections.activeWorkId ?? initialBootstrap.workspace.workId;
    const resolvedChapter = deriveChapterSelection(result.collections, options.chapterId ?? activeChapterId);
    const resolvedSession = deriveSessionSelection(result.collections, options.sessionId ?? activeSessionId);

    setCollections(result.collections);
    setLocale(result.bootstrap.workspace.locale);
    setActiveWorkId(resolvedWorkId);
    setActiveChapterId(resolvedChapter?.id ?? null);
    setActiveSessionId(resolvedSession?.id ?? null);
    setActiveModel(deriveActiveModel(result.collections, activeModel ?? result.collections.activeModel));

    if (!options.preserveEditor) {
      setSelectedChapterTitle(resolvedChapter?.title ?? '');
      setEditorBody(resolvedChapter ? parseChapterText(resolvedChapter.bodyJson) : '');
    }

    return result;
  }, [
    activeChapterId,
    activeModel,
    activeSessionId,
    activeWorkId,
    initialBootstrap.workspace.workId,
    setActiveChapterId,
    setActiveModel,
    setActiveSessionId,
    setActiveWorkId,
    setCollections,
    setEditorBody,
    setLocale,
    setSelectedChapterTitle,
  ]);

  // Persist session context (chapter association) when session or chapter changes
  useEffect(() => {
    if (!activeSessionId || !activeWorkId) return;

    void mutateWorkspace({
      action: 'set-chat-session-context',
      sessionId: activeSessionId,
      workId: activeWorkId,
      chapterId: activeChapterId,
    }, { preserveEditor: true });
  }, [activeSessionId, activeWorkId, activeChapterId, mutateWorkspace]);

  const handleManualSave = useCallback(async () => {
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
    } catch {
      setSaveState('failed');
      toast.error('Failed to save. Check connection.');
    }
  }, [activeChapter, editorBody, mutateWorkspace, selectedChapterTitle]);

  useKeyboardShortcuts({
    'mod+s': handleManualSave,
    'mod+b': () => setIsSidebarOpen(prev => !prev),
    'mod+j': () => {
      const tabs: Array<'ai' | 'snapshots'> = ['ai', 'snapshots'];
      const nextIndex = (tabs.indexOf(rightSidebarTab) + 1) % tabs.length;
      setRightSidebarTab(tabs[nextIndex]);
    },
    'mod+,': () => setIsSettingsOpen(true),
    'mod+shift+w': () => setIsWorldviewOpen(true),
  });

  const refreshWorkspace = useCallback(async (nextWorkId?: string, nextSessionId?: string) => {
    const search = new URLSearchParams();
    if (nextWorkId) search.set('workId', nextWorkId);
    if (nextSessionId) search.set('sessionId', nextSessionId);

    const payload = await readJson<WorkspaceBootstrapResponse>(await fetch(`/api/bootstrap?${search.toString()}`, { cache: 'no-store' }));
    const resolvedWorkId = nextWorkId ?? payload.collections.activeWorkId ?? payload.bootstrap.workspace.workId;
    const resolvedChapter = deriveChapterSelection(payload.collections, activeChapterId);
    const resolvedSession = deriveSessionSelection(payload.collections, nextSessionId ?? activeSessionId);

    setCollections(payload.collections);
    setLocale(payload.bootstrap.workspace.locale);
    setActiveWorkId(resolvedWorkId ?? null);
    setActiveChapterId(resolvedChapter?.id ?? null);
    setActiveSessionId(resolvedSession?.id ?? null);
    setActiveModel(deriveActiveModel(payload.collections, activeModel ?? payload.collections.activeModel));
    setSelectedChapterTitle(resolvedChapter?.title ?? '');
    setEditorBody(resolvedChapter ? parseChapterText(resolvedChapter.bodyJson) : '');
  }, [
    activeChapterId,
    activeModel,
    activeSessionId,
    setActiveChapterId,
    setActiveModel,
    setActiveSessionId,
    setActiveWorkId,
    setCollections,
    setEditorBody,
    setLocale,
    setSelectedChapterTitle,
  ]);

  const refreshSnapshots = useCallback(async (workId?: string) => {
    const query = workId ? `?workId=${workId}` : '';
    const payload = await readJson<{ list: Array<{ id: string; label: string; createdAt: string }> }>(await fetch(`/api/snapshots${query}`, { cache: 'no-store' }));
    setSnapshots(payload.list);
  }, []);

  const resetAgentState = useCallback(() => {
    setAgentStatus('idle');
    setActiveToolName(null);
    setStreamingMessage(null);
    setToolCalls([]);
    streamingStartTimeRef.current = null;
    streamingTokensRef.current = 0;
    latestStreamingTpsRef.current = 0;
  }, []);

  // 使用 queueMicrotask 避免在渲染期间同步调用 setState
  useEffect(() => {
    queueMicrotask(() => {
      resetAgentState();
    });
  }, [activeSessionId, resetAgentState]);

  const calculateTPS = useCallback(() => {
    const startTime = streamingStartTimeRef.current;
    if (!startTime) return 0;
    const elapsed = (Date.now() - startTime) / 1000;
    return elapsed > 0 ? streamingTokensRef.current / elapsed : 0;
  }, []);

  const handleAgentEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case 'ai_start': {
        const startedAt = Date.now();
        setAgentStatus('streaming');
        setActiveToolName(null);
        streamingStartTimeRef.current = startedAt;
        streamingTokensRef.current = 0;
        latestStreamingTpsRef.current = 0;
        setStreamingMessage({
          id: event.messageId,
          role: 'assistant',
          text: '',
          isComplete: false,
          tps: 0,
        });
        return;
      }
      case 'ai_chunk': {
        setAgentStatus('streaming');
        setActiveToolName(null);
        streamingTokensRef.current += 1;
        const currentTPS = calculateTPS();
        latestStreamingTpsRef.current = currentTPS;
        setStreamingMessage({
          id: event.messageId,
          role: 'assistant',
          text: event.accumulatedText,
          isComplete: false,
          tps: currentTPS,
        });
        return;
      }
      case 'ai_tool_call': {
        setAgentStatus('tool_running');
        setActiveToolName(event.toolName);
        setToolCalls((current) => {
          const nextItem: ToolCallItem = {
            id: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
            status: 'running',
          };
          const index = current.findIndex((item) => item.id === event.toolCallId);

          if (index === -1) {
            return [...current, nextItem];
          }

          return current.map((item, itemIndex) => itemIndex === index ? nextItem : item);
        });
        return;
      }
      case 'ai_tool_result': {
        setActiveToolName(null);
        setToolCalls((current) => current.map((item) => (
          item.id === event.toolCallId
            ? {
                ...item,
                status: event.isError ? 'error' : 'success',
                result: event.result,
                error: event.isError ? String(event.result) : undefined,
              }
            : item
        )));
        return;
      }
      case 'ai_complete': {
        setAgentStatus('completed');
        setActiveToolName(null);
        const finalTPS = Math.max(latestStreamingTpsRef.current, calculateTPS());
        latestStreamingTpsRef.current = finalTPS;
        setStreamingMessage({
          id: event.messageId,
          role: 'assistant',
          text: event.fullText,
          isComplete: true,
          tps: finalTPS,
        });
        return;
      }
      case 'ai_error': {
        setAgentStatus('errored');
        setActiveToolName(null);
        return;
      }
      default:
        return;
    }
  }, [calculateTPS]);

  const consumeAgentEventStream = useCallback(async (response: Response) => {
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? 'Agent request failed.');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Agent stream is unavailable.');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let finalText = '';

    const parseEventBlock = (block: string) => {
      const lines = block.split('\n');
      const dataLine = lines.find((line) => line.startsWith('data: '))?.slice(6).trim();

      if (!dataLine) {
        return;
      }

      const event = JSON.parse(dataLine) as AgentEvent;
      handleAgentEvent(event);

      if (event.type === 'ai_chunk') {
        finalText = event.accumulatedText;
      }

      if (event.type === 'ai_complete') {
        finalText = event.fullText;
      }

      if (event.type === 'ai_error') {
        throw new Error(event.error);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        if (block.trim()) {
          parseEventBlock(block);
        }
      }

      if (done) {
        if (buffer.trim()) {
          parseEventBlock(buffer);
        }
        break;
      }
    }

    return {
      finalText,
    };
  }, [handleAgentEvent]);

  const handleCreateSnapshot = useCallback(async () => {
    if (!activeWorkId) return;
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
      body: JSON.stringify({ format, chapters: collections.chapters.map((c) => ({ title: c.title, content: parseChapterText(c.bodyJson) })) }),
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
      } catch {
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
  }, [activeChapter, editorBody, handleManualSave, mutateWorkspace, selectedChapterTitle]);

  const handleSwitchWork = useCallback((workId: string) => {
    void refreshWorkspace(workId);
  }, [refreshWorkspace]);
  const handleSwitchLocale = (nextLocale: SupportedLocale) => {
    setLocale(nextLocale);
    void mutateWorkspace({ action: 'update-work', workId: activeWorkId, locale: nextLocale });
  };
  const handleSwitchChapter = (chapterId: string) => {
    const chapter = collections.chapters.find((entry) => entry.id === chapterId);
    if (!chapter) return;
    setActiveChapterId(chapterId);
    setSelectedChapterTitle(chapter.title);
    setEditorBody(parseChapterText(chapter.bodyJson));
    setPendingGhostText('');
  };



  const handleCreateChapter = useCallback((volumeId?: string) => {
    const nextVolumeId = volumeId ?? collections.volumes[0]?.id;
    if (!activeWorkId || !nextVolumeId) return;

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
    if (!activeWorkId || !volumeDraftTitle.trim()) return;
    void mutateWorkspace({ action: 'create-volume', workId: activeWorkId, title: volumeDraftTitle });
  }, [activeWorkId, mutateWorkspace, volumeDraftTitle]);

  const handleCreateWork = useCallback(() => {
    if (!workDraftTitle.trim()) return;
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

  const handleActiveModelChange = (selection: ActiveModelSelection) => {
    setActiveModel(selection);
    void mutateWorkspace({ action: 'set-active-model', profileId: selection.profileId, modelId: selection.modelId }, { preserveEditor: true });
  };

  const generateSessionTitle = useCallback((prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      const now = new Date();
      return `${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    }
    const firstLine = trimmed.split('\n')[0];
    return firstLine.length > 20 ? `${firstLine.slice(0, 20)}...` : firstLine;
  }, []);

  const handleCreateSession = useCallback(async () => {
    if (!activeWorkId) return;

    // 检查当前session是否为空（没有消息），如果是空的则不创建新session
    const currentSession = collections.chatSessions.find((s) => s.id === activeSessionId);
    if (currentSession) {
      const sessionMessages = collections.chatMessages;
      const hasMessagesInCurrentSession = sessionMessages.length > 0;
      if (!hasMessagesInCurrentSession) {
        // 当前session已经是空的，不需要再创建
        return;
      }
    }

    const title = generateSessionTitle(freeChatPrompt);
    const result = await mutateWorkspace({ action: 'create-chat-session', workId: activeWorkId, title });

    // 切换到新创建的session
    if (result.result && typeof result.result === 'object' && 'session' in result.result) {
      const newSession = (result.result as { session: { id: string } }).session;
      if (newSession?.id) {
        await refreshWorkspace(undefined, newSession.id);
      }
    }
  }, [activeWorkId, activeSessionId, collections.chatMessages, collections.chatSessions, freeChatPrompt, generateSessionTitle, mutateWorkspace, refreshWorkspace]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    void mutateWorkspace({ action: 'delete-chat-session', sessionId });
  }, [mutateWorkspace]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    void mutateWorkspace({ action: 'delete-chat-message', messageId });
  }, [mutateWorkspace]);

  const handleSendPrompt = useCallback(async (prompt?: string) => {
    const currentPrompt = prompt ?? freeChatPrompt;
    if (!currentPrompt.trim() || !activeModel) return;
    const trimmedPrompt = currentPrompt.trim();

    // 如果没有 active session，先创建一个新 session
    let sessionId = activeSessionId;
    if (!sessionId) {
      if (!activeWorkId) return;
      const title = generateSessionTitle(trimmedPrompt);
      const result = await mutateWorkspace({ action: 'create-chat-session', workId: activeWorkId, title });
      if (result.result && typeof result.result === 'object' && 'session' in result.result) {
        const newSession = (result.result as { session: { id: string } }).session;
        if (newSession?.id) {
          sessionId = newSession.id;
          await refreshWorkspace(undefined, newSession.id);
        }
      }
      if (!sessionId) return;
    }

    // 立即清空输入框，防止重复发送
    setFreeChatPrompt('');
    resetAgentState();

    await mutateWorkspace({
      action: 'append-chat-message',
      sessionId,
      role: 'user',
      body: trimmedPrompt,
      tps: 0,
    }, { preserveEditor: true, sessionId });

    try {
      const response = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profileId: activeModel.profileId,
          modelId: activeModel.modelId,
          prompt: trimmedPrompt,
          sessionId,
        }),
      });

      const agentResult = await consumeAgentEventStream(response);

      if (agentResult.finalText.trim()) {
        await mutateWorkspace({
          action: 'append-chat-message',
          sessionId,
          role: 'assistant',
          body: agentResult.finalText,
          tps: latestStreamingTpsRef.current,
        }, { preserveEditor: true, sessionId });
      }
    } catch (error) {
      setAgentStatus('errored');
      toast.error(error instanceof Error ? error.message : 'AI 请求失败。');
    }
  }, [activeModel, activeSessionId, activeWorkId, consumeAgentEventStream, freeChatPrompt, generateSessionTitle, mutateWorkspace, refreshWorkspace, resetAgentState]);

  const handleRetryMessage = useCallback(async (messageId: string) => {
    if (!activeSessionId || !activeModel) return;

    const message = collections.chatMessages.find((m) => m.id === messageId);
    if (!message || message.role !== 'assistant') return;

    setRetryingMessageId(messageId);
    resetAgentState();

    try {
      const response = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profileId: activeModel.profileId,
          modelId: activeModel.modelId,
          prompt: message.body,
          sessionId: activeSessionId,
        }),
      });

      const agentResult = await consumeAgentEventStream(response);

      if (agentResult.finalText.trim()) {
        setRetryVersions((prev) => {
          const current = prev.get(messageId);
          if (current) {
            const newVersions = [...current.versions, agentResult.finalText];
            return new Map(prev).set(messageId, {
              currentIndex: newVersions.length - 1,
              versions: newVersions,
            });
          }
          return new Map(prev).set(messageId, {
            currentIndex: 1,
            versions: [message.body, agentResult.finalText],
          });
        });
      }
    } catch (error) {
      setAgentStatus('errored');
      toast.error(error instanceof Error ? error.message : '重试失败。');
    } finally {
      setRetryingMessageId(null);
    }
  }, [activeModel, activeSessionId, collections.chatMessages, consumeAgentEventStream, resetAgentState]);

  const handleSwitchRetryVersion = useCallback((messageId: string, direction: 'prev' | 'next') => {
    setRetryVersions((prev) => {
      const current = prev.get(messageId);
      if (!current) return prev;

      const newIndex = direction === 'prev'
        ? Math.max(0, current.currentIndex - 1)
        : Math.min(current.versions.length - 1, current.currentIndex + 1);

      return new Map(prev).set(messageId, {
        ...current,
        currentIndex: newIndex,
      });
    });
  }, []);

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
          onOpenModelSelector={() => setIsSettingsOpen(true)}
          providers={collections.providerProfiles}
        />
      </div>

      <div className="app-main">
        <aside
          className={cx(
            "app-sidebar sidebar-transition overflow-hidden",
            isSidebarOpen ? "w-[240px] opacity-100" : "w-0 opacity-0 border-none"
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
              onOpenSettingsAction={() => setIsSettingsOpen(true)}
              onOpenWorldviewAction={() => setIsWorldviewOpen(true)}
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
            onBodyChange={(value) => { setEditorBody(value); setSaveState('modified'); }}
            onTitleChange={(value) => { setSelectedChapterTitle(value); setSaveState('modified'); }}
            onAcceptGhostText={() => { setEditorBody((c) => `${c}\n\n${pendingGhostText}`.trim()); setPendingGhostText(''); setSaveState('modified'); }}
            onRejectGhostText={() => setPendingGhostText('')}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
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
              className={cx("flex-1 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors", rightSidebarTab === 'ai' ? "bg-background border-b-2 border-primary" : "bg-muted/50 text-muted-foreground")}
              onClick={() => setRightSidebarTab('ai')}
            >
              AI
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
                messages={collections.chatMessages}
                activeModel={activeModel}
                activeSessionId={activeSessionId}
                draftPrompt={freeChatPrompt}
                retryingMessageId={retryingMessageId}
                retryVersions={retryVersions}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onCreateSession={handleCreateSession}
                onDeleteSession={handleDeleteSession}
                onSessionChange={(sid) => refreshWorkspace(undefined, sid)}
                onDraftPromptChange={setFreeChatPrompt}
                onSendPrompt={handleSendPrompt}
                onRetryMessage={handleRetryMessage}
                onDeleteMessage={handleDeleteMessage}
                onSwitchRetryVersion={handleSwitchRetryVersion}
                providers={collections.providerProfiles}
                sessions={collections.chatSessions}
                agentStatus={agentStatus}
                activeToolName={activeToolName}
                streamingMessage={streamingMessage}
                toolCalls={toolCalls}
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
          onProvidersChangeAction={() => refreshWorkspace(activeWorkId ?? undefined, activeSessionId ?? undefined)}
          onCloseAction={() => setIsSettingsOpen(false)}
        />
      )}
      {isWorldviewOpen && (
        <WorldviewDialog
          copy={copy}
          workId={activeWorkId ?? ''}
          nodes={collections.settingsNodes}
          onClose={() => setIsWorldviewOpen(false)}
          onMutate={async (action, payload) => {
            return await mutateWorkspace({ action, ...payload }, { preserveEditor: true });
          }}
        />
      )}
    </main>
  );
}
