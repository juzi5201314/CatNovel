'use client';

import { useState } from 'react';
import type { ProviderFamily, ProviderProfileRecord } from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cx } from '@/lib/design/cx';

const familyLabels: Record<ProviderFamily, string> = {
  'openai-compatible': 'OpenAI',
  'claude-native': 'Claude',
  'gemini-native': 'Gemini',
  'custom-endpoint': 'Custom',
};

export function ProviderList({
  copy,
  providers,
  selectedId,
  onSelect,
  onAdd,
}: {
  copy: AppMessages;
  providers: ProviderProfileRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <span className="text-mono-label">{copy.addProvider.replace('添加', '供应商').replace('Add', 'Providers')}</span>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-lg" onClick={onAdd}>+</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {providers.map((provider) => (
          <button
            key={provider.id}
            onClick={() => onSelect(provider.id)}
            className={cx(
              "w-full text-left p-3 rounded-lg transition-all text-sm",
              provider.id === selectedId
                ? "bg-muted shadow-sm ring-1 ring-primary/20"
                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium truncate">{provider.label}</span>
              <Badge tone={provider.enabled ? 'blue' : 'neutral'} className="text-[9px] px-1.5 py-0 shrink-0">
                {familyLabels[provider.family]}
              </Badge>
            </div>
            <p className="text-[10px] mt-1 opacity-50 truncate">{provider.endpoint}</p>
          </button>
        ))}

        {providers.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8 opacity-60">{copy.noProviderSelected}</p>
        )}
      </div>
    </div>
  );
}
