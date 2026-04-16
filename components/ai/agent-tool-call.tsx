'use client';

import { useState } from 'react';
import { cx } from '@/lib/design/cx';

export type ToolCallStatus = 'running' | 'success' | 'error';

export interface AgentToolCallProps {
  toolName: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
}

// 工具图标映射
function ToolIcon({ name, className }: { name: string; className?: string }) {
  // 根据工具名返回不同的图标 SVG
  const getIcon = () => {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('search') || lowerName.includes('find')) {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    }
    
    if (lowerName.includes('file') || lowerName.includes('read') || lowerName.includes('write')) {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    }
    
    if (lowerName.includes('db') || lowerName.includes('database') || lowerName.includes('sql')) {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5V19A9 3 0 0 0 21 19V5" />
          <path d="M3 12A9 3 0 0 0 21 12" />
        </svg>
      );
    }
    
    if (lowerName.includes('calc') || lowerName.includes('math') || lowerName.includes('compute')) {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M8 6h8" />
          <path d="M16 14l-4-4" />
          <path d="M16 10l-4 4" />
          <path d="M8 18h8" />
        </svg>
      );
    }
    
    if (lowerName.includes('web') || lowerName.includes('http') || lowerName.includes('fetch')) {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    }
    
    // 默认工具图标
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    );
  };
  
  return getIcon();
}

// 状态指示器组件
function StatusBadge({ status }: { status: ToolCallStatus }) {
  const statusConfig = {
    running: {
      className: 'bg-[var(--cn-blue-tint)] text-[var(--cn-blue-strong)]',
      text: '执行中',
    },
    success: {
      className: 'bg-green-50 text-green-600',
      text: '成功',
    },
    error: {
      className: 'bg-red-50 text-red-500',
      text: '失败',
    },
  };
  
  const config = statusConfig[status];
  
  return (
    <span className={cx('px-2 py-0.5 rounded-full text-xs font-medium', config.className)}>
      {status === 'running' && (
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {config.text}
        </span>
      )}
      {status !== 'running' && config.text}
    </span>
  );
}

// 参数预览组件
function ArgsPreview({ args }: { args: Record<string, unknown> }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const entries = Object.entries(args);
  const previewEntries = entries.slice(0, 2);
  const hasMore = entries.length > 2;
  
  return (
    <div className="mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-xs text-[var(--cn-text-muted)] hover:text-[var(--cn-text-secondary)] transition-colors flex items-center gap-1"
      >
        <svg
          className={cx('w-3 h-3 transition-transform', isExpanded && 'rotate-90')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        参数 ({entries.length})
      </button>
      
      {isExpanded ? (
        <div className="mt-2 p-2 bg-[var(--cn-bg-muted)] rounded text-xs font-mono overflow-x-auto">
          <pre className="text-[var(--cn-text-secondary)]">
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1">
          {previewEntries.map(([key, value]) => (
            <span
              key={key}
              className="px-1.5 py-0.5 bg-[var(--cn-bg-soft)] rounded text-[10px] text-[var(--cn-text-muted)] truncate max-w-[150px]"
              title={`${key}: ${JSON.stringify(value)}`}
            >
              {key}
            </span>
          ))}
          {hasMore && (
            <span className="px-1.5 py-0.5 text-[10px] text-[var(--cn-text-muted)]">
              +{entries.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentToolCall({ toolName, args, status }: AgentToolCallProps) {
  return (
    <div className={cx(
      'agent-tool-call rounded-lg border p-3 bg-[var(--cn-bg)]',
      'shadow-[var(--cn-light-ring-shadow)]',
      status === 'running' && 'border-[var(--cn-blue)]/30',
      status === 'success' && 'border-green-500/30',
      status === 'error' && 'border-red-500/30'
    )}>
      <div className="flex items-center gap-3">
        <div className={cx(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          status === 'running' && 'bg-[var(--cn-blue-tint)] text-[var(--cn-blue-strong)]',
          status === 'success' && 'bg-green-50 text-green-600',
          status === 'error' && 'bg-red-50 text-red-500'
        )}>
          <ToolIcon name={toolName} className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-[var(--cn-text)] truncate">
              {toolName}
            </span>
            <StatusBadge status={status} />
          </div>
          
          <ArgsPreview args={args} />
        </div>
      </div>
    </div>
  );
}
