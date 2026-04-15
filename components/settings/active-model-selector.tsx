'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActiveModelSelection, ProviderProfileRecord } from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { cx } from '@/lib/design/cx';

export function ActiveModelSelector({
  copy,
  providers,
  activeModel,
  onChange,
}: {
  copy: AppMessages;
  providers: ProviderProfileRecord[];
  activeModel: ActiveModelSelection | null;
  onChange: (selection: ActiveModelSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      return;
    }
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const allModels = useMemo(() =>
    providers
      .filter((p) => p.enabled)
      .flatMap((p) =>
        p.modelIds.map((m) => ({
          profileId: p.id,
          modelId: m,
          label: `${p.label} / ${m}`,
          providerLabel: p.label,
        })),
      ),
    [providers]
  );

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return allModels;
    const query = searchQuery.toLowerCase();
    return allModels.filter((m) =>
      m.label.toLowerCase().includes(query) ||
      m.modelId.toLowerCase().includes(query)
    );
  }, [allModels, searchQuery]);

  const activeLabel = activeModel
    ? (() => {
        const profile = providers.find((p) => p.id === activeModel.profileId);
        return profile ? `${profile.label} / ${activeModel.modelId}` : activeModel.modelId;
      })()
    : '—';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-sm font-medium transition-colors"
      >
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{copy.activeModel}</span>
        <span className="text-foreground truncate max-w-[280px]">{activeLabel}</span>
        <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-background rounded-xl shadow-2xl border border-border w-[560px] max-h-[80vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold">{copy.modelSettings}</h3>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            <div className="p-4 border-b">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models..."
                  className="w-full h-10 pl-10 pr-4 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {filteredModels.length} of {allModels.length} models
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredModels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm">No models found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredModels.map((item) => {
                    const isActive = activeModel?.profileId === item.profileId && activeModel?.modelId === item.modelId;
                    return (
                      <button
                        key={`${item.profileId}::${item.modelId}`}
                        onClick={() => {
                          onChange({ profileId: item.profileId, modelId: item.modelId });
                          setOpen(false);
                        }}
                        className={cx(
                          "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group",
                          isActive
                            ? "bg-primary/10 text-foreground font-medium ring-1 ring-primary/20"
                            : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          <span className="flex-1 truncate">{item.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
