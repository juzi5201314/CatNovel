"use client";

import { useEffect, useState, useMemo } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const projects = useWorkspaceStore((state) => state.projects);
  const chapters = useWorkspaceStore((state) => state.chapters);
  const selectProject = useWorkspaceStore((state) => state.selectProject);
  const selectChapter = useWorkspaceStore((state) => state.selectChapter);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase().trim();
    const items: Array<{ type: 'project' | 'chapter', id: string, name: string, sub?: string }> = [];

    if (!q) {
      projects.slice(0, 5).forEach(p => items.push({ type: 'project', id: p.id, name: p.name, sub: 'Project' }));
      chapters.slice(0, 5).forEach(c => items.push({ type: 'chapter', id: c.id, name: c.title, sub: `Chapter ${c.orderNo}` }));
    } else {
      projects.forEach(p => {
        if (p.name.toLowerCase().includes(q)) items.push({ type: 'project', id: p.id, name: p.name, sub: 'Project' });
      });
      chapters.forEach(c => {
        if (c.title.toLowerCase().includes(q)) items.push({ type: 'chapter', id: c.id, name: c.title, sub: 'Chapter' });
      });
    }
    return items;
  }, [query, projects, chapters]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setQuery("");
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const effectiveSelectedIndex =
    filteredItems.length === 0 ? 0 : Math.min(selectedIndex, filteredItems.length - 1);

  const handleSelect = (item: typeof filteredItems[0]) => {
    if (item.type === 'project') selectProject(item.id);
    else selectChapter(item.id);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setIsOpen(false)} />
      <div className="relative bg-background w-full max-w-xl rounded-xl border border-border shadow-2xl overflow-hidden zoom-in-95 animate-in duration-200">
        <div className="flex items-center px-4 border-b border-border bg-muted/10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted-foreground"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            autoFocus
            className="flex-1 bg-transparent border-none outline-none py-4 px-3 text-sm font-medium placeholder:text-muted-foreground"
            placeholder="Search projects, chapters, settings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (filteredItems.length === 0) {
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(i => (i + 1) % filteredItems.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(i => (i - 1 + filteredItems.length) % filteredItems.length);
              } else if (e.key === 'Enter') {
                const item = filteredItems[effectiveSelectedIndex];
                if (item) handleSelect(item);
              }
            }}
          />
          <kbd className="bg-muted text-[10px] px-1.5 py-0.5 rounded font-bold opacity-50">ESC</kbd>
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
          {filteredItems.map((item, idx) => (
            <button
              key={`${item.type}-${item.id}`}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-colors ${
                idx === effectiveSelectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              }`}
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={() => handleSelect(item)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${item.type === 'project' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                <span className="text-sm font-semibold">{item.name}</span>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${idx === effectiveSelectedIndex ? "text-accent-foreground/70" : "text-muted-foreground"}`}>
                {item.sub}
              </span>
            </button>
          ))}
          {filteredItems.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm font-medium italic">
              {`No results found for "${query}"`}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border bg-muted/5 flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
          <div className="flex items-center gap-1"><kbd className="bg-muted px-1 rounded shadow-none">↵</kbd> Select</div>
          <div className="flex items-center gap-1"><kbd className="bg-muted px-1 rounded shadow-none">↑↓</kbd> Navigate</div>
          <div className="flex items-center gap-1"><kbd className="bg-muted px-1 rounded shadow-none">⌘K</kbd> Close</div>
        </div>
      </div>
    </div>
  );
}
