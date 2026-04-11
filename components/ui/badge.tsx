import type { ReactNode } from 'react';
import { cx } from '../../lib/design/cx';

type BadgeTone = 'blue' | 'neutral' | 'red';

export function Badge({
  children,
  className,
  tone = 'blue',
  pulse = false,
}: {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
  pulse?: boolean;
}) {
  return (
    <span className={cx(
      'badge', 
      `badge--${tone}`, 
      pulse && 'animate-pulse-subtle',
      className
    )}>
      {children}
    </span>
  );
}
