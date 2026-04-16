'use client';

import { cx } from '@/lib/design/cx';

export type AgentStatus = 'thinking' | 'executing' | 'completed' | 'error';

export interface AgentStatusIndicatorProps {
  status: AgentStatus;
  toolName?: string;
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className)} viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function ToolIcon({ className, animated }: { className?: string; animated?: boolean }) {
  return (
    <svg 
      className={cx(className, animated && 'animate-pulse')} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function getStatusText(status: AgentStatus, toolName?: string) {
  switch (status) {
    case 'thinking':
      return 'AI 思考中...';
    case 'executing':
      return toolName ? `执行工具: ${toolName}` : '执行工具中...';
    case 'completed':
      return '已完成';
    case 'error':
      return '执行出错';
    default:
      return '';
  }
}

function getStatusStyles(status: AgentStatus) {
  switch (status) {
    case 'thinking':
      return {
        container: 'bg-[var(--cn-blue-tint)] border-[var(--cn-blue)]/20',
        icon: 'text-[var(--cn-blue-strong)]',
        text: 'text-[var(--cn-blue-strong)]',
      };
    case 'executing':
      return {
        container: 'bg-[var(--cn-blue-tint)] border-[var(--cn-blue)]/30',
        icon: 'text-[var(--cn-blue-strong)]',
        text: 'text-[var(--cn-blue-strong)]',
      };
    case 'completed':
      return {
        container: 'bg-green-50 border-green-500/20',
        icon: 'text-green-600',
        text: 'text-green-600',
      };
    case 'error':
      return {
        container: 'bg-red-50 border-red-500/20',
        icon: 'text-red-500',
        text: 'text-red-500',
      };
    default:
      return {
        container: 'bg-[var(--cn-bg-muted)] border-[var(--cn-line)]',
        icon: 'text-[var(--cn-text-muted)]',
        text: 'text-[var(--cn-text-muted)]',
      };
  }
}

export function AgentStatusIndicator({ status, toolName }: AgentStatusIndicatorProps) {
  const styles = getStatusStyles(status);
  const text = getStatusText(status, toolName);
  
  return (
    <div className={cx(
      'agent-status-indicator inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm',
      styles.container,
      styles.text
    )}>
      {status === 'thinking' && (
        <Spinner className={cx('w-4 h-4', styles.icon)} />
      )}
      {status === 'executing' && (
        <ToolIcon className={cx('w-4 h-4', styles.icon)} animated />
      )}
      {status === 'completed' && (
        <CheckIcon className={cx('w-4 h-4', styles.icon)} />
      )}
      {status === 'error' && (
        <ErrorIcon className={cx('w-4 h-4', styles.icon)} />
      )}
      <span className="font-medium">{text}</span>
    </div>
  );
}
