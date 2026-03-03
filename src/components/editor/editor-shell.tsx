"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { EditorToolbar } from "./editor-toolbar";
import { SaveIndicator } from "./save-indicator";
import type { EditorSavePayload, EditorShellProps, EditorSaveStatus } from "./types";

type EditorMode = "edit" | "preview";

export function EditorShell({
  chapter,
  onSave,
  autosaveDelayMs = 1000,
}: EditorShellProps) {
  const [mode, setMode] = useState<EditorMode>("edit");
  const [saveStatus, setSaveStatus] = useState<EditorSaveStatus>("idle");
  const [dirty, setDirty] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [draftVersion, setDraftVersion] = useState(0);

  const lastSavedContentRef = useRef("");
  const saveInFlightRef = useRef(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: chapter?.content ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none min-h-[500px] py-12 px-8 sm:px-12 max-w-none",
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
    if (!editor) return;

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
  }, [chapter?.id, chapter?.content, editor]);

  const persist = useCallback(
    async (force: boolean) => {
      if (!editor || !chapter || saveInFlightRef.current) return;

      const currentContent = editor.getHTML();
      if (!force && currentContent === lastSavedContentRef.current) return;

      saveInFlightRef.current = true;
      setSaveStatus("saving");

      try {
        const payload: EditorSavePayload = {
          content: currentContent,
        };
        if (typeof chapter.summary === "string") {
          payload.summary = chapter.summary;
        }
        await onSave(payload);

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
    if (!chapter || !editor || !dirty) return;

    const timer = window.setTimeout(() => {
      void persist(false);
    }, autosaveDelayMs);

    return () => window.clearTimeout(timer);
  }, [autosaveDelayMs, chapter, dirty, draftVersion, editor, persist]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!chapter) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void persist(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chapter, persist]);

  const chapterSubtitle = useMemo(() => {
    if (!chapter) return "No Chapter Selected";
    return `Chapter ${chapter.orderNo} · ${chapter.title}`;
  }, [chapter]);

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">{chapterSubtitle}</h1>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
             <SaveIndicator status={saveStatus} dirty={dirty} wordCount={wordCount} />
             <span className="opacity-50">|</span>
             <span>Autosave active</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-1 mr-2 border border-border/50">
            <button 
              onClick={() => setMode("edit")}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 ${mode === 'edit' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Edit
              <kbd className={`ml-1 transition-opacity ${mode === 'edit' ? 'opacity-40' : 'opacity-0'}`}>E</kbd>
            </button>
            <button 
              onClick={() => setMode("preview")}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all flex items-center gap-2 ${mode === 'preview' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Preview
              <kbd className={`ml-1 transition-opacity ${mode === 'preview' ? 'opacity-40' : 'opacity-0'}`}>P</kbd>
            </button>
          </div>
          <button
            type="button"
            onClick={() => void persist(true)}
            disabled={!chapter || saveStatus === "saving"}
            className="text-xs font-bold px-5 py-2 primary rounded-lg shadow-lg shadow-black/5 hover:shadow-accent/20 transition-all flex items-center gap-2"
          >
            {saveStatus === "saving" ? "Saving..." : "Save"}
            <kbd className="bg-white/20 border-none shadow-none text-white opacity-60">⌘ S</kbd>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-12 custom-scrollbar bg-muted/10">
        <div className="max-w-4xl mx-auto">
          {mode === "edit" ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="min-h-[700px] flex flex-col bg-background rounded-xl border border-border shadow-lg overflow-hidden">
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-8 sm:px-12 py-4">
                  <EditorToolbar editor={editor} />
                </div>
                
                <div className="flex-1 relative">
                  {chapter ? (
                    <div className="h-full">
                      <EditorContent editor={editor} />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground space-y-4">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-20"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <p className="text-sm font-medium">Select a chapter from the sidebar to start writing.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-background rounded-xl border border-border shadow-sm p-12 min-h-[800px]">
                <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto">
                  <h1 className="text-4xl font-bold mb-8 border-b border-border pb-4">{chapter?.title}</h1>
                  <div 
                    dangerouslySetInnerHTML={{ __html: editor?.getHTML() ?? "" }} 
                    className="preview-content"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
