import * as React from 'react';

import { cx } from '@/lib/design/cx';

export function Separator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cx('h-px w-full bg-[var(--color-line)]', className)}
      {...props}
    />
  );
}
