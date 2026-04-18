'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { ChapterRecord } from '@/lib/contracts/workspace';

import { parseChapterText, serializeChapterText } from '../workspace-data';
import type { WorkspaceMutationOptions } from '../workspace-shell.types';

export function useEditorDraft({
  initialChapter,
  activeChapter,
  mutateWorkspace,
}: {
  initialChapter: ChapterRecord | null;
  activeChapter: ChapterRecord | null;
  mutateWorkspace: (payload: Record<string, unknown>, options?: WorkspaceMutationOptions) => Promise<unknown>;
}) {
  const [selectedChapterTitle, setSelectedChapterTitle] = useState(initialChapter?.title ?? '');
  const [editorBody, setEditorBody] = useState(initialChapter ? parseChapterText(initialChapter.bodyJson) : '');
  const [saveState, setSaveState] = useState('idle');
  const [pendingGhostText, setPendingGhostText] = useState('');

  const replaceFromChapter = useCallback((chapter: ChapterRecord | null) => {
    setSelectedChapterTitle(chapter?.title ?? '');
    setEditorBody(chapter ? parseChapterText(chapter.bodyJson) : '');
    setPendingGhostText('');
  }, []);

  const handleManualSave = useCallback(async () => {
    if (!activeChapter) {
      return;
    }

    setSaveState('saving');

    try {
      await mutateWorkspace(
        {
          action: 'autosave-chapter',
          chapterId: activeChapter.id,
          title: selectedChapterTitle,
          bodyJson: serializeChapterText(editorBody),
        },
        { preserveEditor: true },
      );
      setSaveState('saved');
      toast.success('Chapter saved manually.');
    } catch {
      setSaveState('failed');
      toast.error('Failed to save. Check connection.');
    }
  }, [activeChapter, editorBody, mutateWorkspace, selectedChapterTitle]);

  useEffect(() => {
    if (!activeChapter) {
      return;
    }

    const canonicalText = parseChapterText(activeChapter.bodyJson);
    if (selectedChapterTitle === activeChapter.title && editorBody === canonicalText) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setSaveState('autosaving');

      try {
        await mutateWorkspace(
          {
            action: 'autosave-chapter',
            chapterId: activeChapter.id,
            title: selectedChapterTitle,
            bodyJson: serializeChapterText(editorBody),
          },
          { preserveEditor: true },
        );
        setSaveState('saved');
      } catch {
        setSaveState('failed');
        toast.error('Autosave failed. Check your connection.', {
          action: {
            label: 'Retry',
            onClick: () => {
              void handleManualSave();
            },
          },
        });
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [activeChapter, editorBody, handleManualSave, mutateWorkspace, selectedChapterTitle]);

  const handleBodyChange = useCallback((value: string) => {
    setEditorBody(value);
    setSaveState('modified');
  }, []);

  const handleTitleChange = useCallback((value: string) => {
    setSelectedChapterTitle(value);
    setSaveState('modified');
  }, []);

  const acceptGhostText = useCallback(() => {
    setEditorBody((current) => `${current}\n\n${pendingGhostText}`.trim());
    setPendingGhostText('');
    setSaveState('modified');
  }, [pendingGhostText]);

  const rejectGhostText = useCallback(() => {
    setPendingGhostText('');
  }, []);

  return {
    selectedChapterTitle,
    editorBody,
    saveState,
    pendingGhostText,
    setPendingGhostText,
    setSaveState,
    replaceFromChapter,
    handleManualSave,
    handleBodyChange,
    handleTitleChange,
    acceptGhostText,
    rejectGhostText,
  };
}
