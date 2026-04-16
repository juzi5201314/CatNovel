'use client';

import { useEffect } from 'react';

import { cx } from '@/lib/design/cx';

const defaultStorageKey = 'catnovel:free-chat-agent-mode';

export interface AgentModeToggleProps {
  isAgentMode: boolean;
  onToggle: (enabled: boolean) => void;
  storageKey?: string;
}

export function AgentModeToggle({
  isAgentMode,
  onToggle,
  storageKey = defaultStorageKey,
}: AgentModeToggleProps) {
  useEffect(() => {
    const storedPreference = window.localStorage.getItem(storageKey);
    if (storedPreference !== 'true' && storedPreference !== 'false') {
      return;
    }

    onToggle(storedPreference === 'true');
  }, [onToggle, storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(isAgentMode));
  }, [isAgentMode, storageKey]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2">
      <div className="space-y-1">
        <p className="text-xs font-medium text-foreground">自由对话模式</p>
        <p className="text-[11px] text-muted-foreground">
          默认保留传统模式，需要时切换到 Agent 模式。
        </p>
      </div>
      <div
        className="inline-flex rounded-full border bg-muted/40 p-1"
        role="group"
        aria-label="切换自由对话模式"
      >
        <button
          type="button"
          onClick={() => onToggle(false)}
          className={cx(
            'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
            !isAgentMode
              ? 'bg-background text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.08)]'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={!isAgentMode}
        >
          传统模式
        </button>
        <button
          type="button"
          onClick={() => onToggle(true)}
          className={cx(
            'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
            isAgentMode
              ? 'bg-[var(--cn-blue-tint)] text-[var(--cn-blue-strong)] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={isAgentMode}
        >
          Agent 模式
        </button>
      </div>
    </div>
  );
}
