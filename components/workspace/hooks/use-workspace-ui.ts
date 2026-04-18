'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

type RightSidebarTab = 'ai' | 'snapshots';

export function useWorkspaceUi({
  onManualSave,
}: {
  onManualSave: () => void;
}): {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  rightSidebarTab: RightSidebarTab;
  setAiTab: () => void;
  setSnapshotsTab: () => void;
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  isWorldviewOpen: boolean;
  openWorldview: () => void;
  closeWorldview: () => void;
  rightSidebarWidth: number;
  sidebarRef: RefObject<HTMLElement | null>;
  handleResizeStart: (event: ReactMouseEvent) => void;
} {
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>('ai');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWorldviewOpen, setIsWorldviewOpen] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
  const sidebarRef = useRef<HTMLElement>(null);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(320);
  const rafRef = useRef<number | null>(null);

  const handleResizeStart = useCallback((event: ReactMouseEvent) => {
    isResizingRef.current = true;
    startXRef.current = event.clientX;
    startWidthRef.current = rightSidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [rightSidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingRef.current) {
        return;
      }

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        const delta = startXRef.current - event.clientX;
        const newWidth = Math.max(240, Math.min(600, startWidthRef.current + delta));

        if (sidebarRef.current) {
          sidebarRef.current.style.width = `${newWidth}px`;
        }
      });
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) {
        return;
      }

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

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((current) => !current);
  }, []);

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const openWorldview = useCallback(() => {
    setIsWorldviewOpen(true);
  }, []);

  const closeWorldview = useCallback(() => {
    setIsWorldviewOpen(false);
  }, []);

  const setAiTab = useCallback(() => {
    setRightSidebarTab('ai');
  }, []);

  const setSnapshotsTab = useCallback(() => {
    setRightSidebarTab('snapshots');
  }, []);

  useKeyboardShortcuts({
    'mod+s': onManualSave,
    'mod+b': toggleSidebar,
    'mod+j': () => {
      setRightSidebarTab((current) => (current === 'ai' ? 'snapshots' : 'ai'));
    },
    'mod+,': openSettings,
    'mod+shift+w': openWorldview,
  });

  return {
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
  };
}
