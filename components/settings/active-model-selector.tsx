'use client';

import { useEffect, useRef, useState } from 'react';
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const allModels = providers
    .filter((p) => p.enabled)
    .flatMap((p) =>
      p.modelIds.map((m) => ({
        profileId: p.id,
        modelId: m,
        label: `${p.label} / ${m}`,
      })),
    );

  const activeLabel = activeModel
    ? (() => {
        const profile = providers.find((p) => p.id === activeModel.profileId);
        return profile ? `${profile.label} / ${activeModel.modelId}` : activeModel.modelId;
      })()
    : '—';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-sm font-medium transition-colors"
      >
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{copy.activeModel}</span>
        <span className="text-foreground truncate max-w-[280px]">{activeLabel}</span>
        <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 max-h-64 overflow-y-auto bg-background rounded-lg shadow-lg border border-border z-50 animate-fade-in">
          {allModels.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">{copy.noProviderSelected}</p>
          )}
          {allModels.map((item) => (
            <button
              key={`${item.profileId}::${item.modelId}`}
              onClick={() => {
                onChange({ profileId: item.profileId, modelId: item.modelId });
                setOpen(false);
              }}
              className={cx(
                "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                activeModel?.profileId === item.profileId && activeModel?.modelId === item.modelId
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
