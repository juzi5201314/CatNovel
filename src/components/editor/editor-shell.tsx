"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { EditorToolbar } from "./editor-toolbar";
import { SaveIndicator } from "./save-indicator";
import type { EditorShellProps, EditorSaveStatus } from "./types";

export function EditorShell({
  chapter,
  onSave,
  autosaveDelayMs = 1000,
}: EditorShellProps) {
  const [saveStatus, setSaveStatus] = useState<EditorSaveStatus>("idle");
  const [dirty, setDirty] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [draftVersion, setDraftVersion] = useState(0);

  const lastSavedContentRef = useRef("");
  const saveInFlightRef = useRef(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: chapter?.content ?? "",
    editorProps: {
      attributes: {
        class:
          "min-h-[420px] rounded-lg border border-[var(--cn-border)] bg-white p-4 outline-none focus:border-[#21636b]",
      },
    },
    onUpdate({ editor: currentEditor }) {
      setWordCount(currentEditor.state.doc.textContent.length);
      setDirty(true);
      setSaveStatus("idle");
      setDraftVersion((value) => value + 1);
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (!chapter) {
      editor.commands.setContent("", { emitUpdate: false });
      lastSavedContentRef.current = "";
      setWordCount(0);
      setDirty(false);
      setSaveStatus("idle");
      return;
    }

    const nextContent = chapter.content ?? "";
    editor.commands.setContent(nextContent, { emitUpdate: false });
    lastSavedContentRef.current = nextContent;
    setWordCount(editor.state.doc.textContent.length);
    setDirty(false);
    setSaveStatus("idle");
  }, [chapter?.id, chapter?.content, editor, chapter]);

  const persist = useCallback(
    async (force: boolean) => {
      if (!editor || !chapter || saveInFlightRef.current) {
        return;
      }

      const currentContent = editor.getHTML();
      if (!force && currentContent === lastSavedContentRef.current) {
        return;
      }

      saveInFlightRef.current = true;
      setSaveStatus("saving");

      try {
        await onSave({
          content: currentContent,
          summary: chapter.summary ?? null,
        });

        lastSavedContentRef.current = currentContent;
        setDirty(false);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [chapter, editor, onSave],
  );

  useEffect(() => {
    if (!chapter || !editor || !dirty) {
      return;
    }

    // 关键逻辑：内容变更后按固定延时自动保存，减少频繁写入。
    const timer = window.setTimeout(() => {
      void persist(false);
    }, autosaveDelayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autosaveDelayMs, chapter, dirty, draftVersion, editor, persist]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!chapter) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void persist(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [chapter, persist]);

  const chapterSubtitle = useMemo(() => {
    if (!chapter) {
      return "未选择章节";
    }

    return `第 ${chapter.orderNo} 章 · ${chapter.title}`;
  }, [chapter]);

  return (
    <section className="cn-panel flex h-full min-h-[640px] flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--cn-text-primary)]">{chapterSubtitle}</h3>
          <p className="text-sm text-[var(--cn-text-secondary)]">支持自动保存与 Ctrl/Cmd+S 手动保存</p>
        </div>

        <button
          type="button"
          onClick={() => void persist(true)}
          disabled={!chapter || saveStatus === "saving"}
          className="rounded-md border border-[var(--cn-border)] bg-white px-3 py-1.5 text-sm text-[var(--cn-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          立即保存
        </button>
      </header>

      <EditorToolbar editor={editor} />
      <SaveIndicator status={saveStatus} dirty={dirty} wordCount={wordCount} />

      {chapter ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-[var(--cn-border)] bg-white text-[var(--cn-text-secondary)]">
          请选择章节后开始编辑
        </div>
      )}
    </section>
  );
}
