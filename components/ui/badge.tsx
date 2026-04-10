import type { ReactNode } from 'react';

import { cx } from '../../lib/design/cx';

type BadgeTone = 'default' | 'neutral' | 'red';

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return <span className={cx('badge', tone !== 'default' && `badge--${tone}`)}>{children}</span>;
}
