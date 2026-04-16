import type { ReactNode } from 'react';

import { cx } from '@/lib/design/cx';

export function Panel({
  id,
  title,
  subtitle,
  badge,
  className,
  bodyClassName,
  children,
}: {
  id?: string;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx('surface', className)} id={id}>
      <div className={cx('surface__body', bodyClassName)}>
        <header className="surface__head">
          <div>
            <h2 className="surface__title">{title}</h2>
            <p className="surface__subtitle">{subtitle}</p>
          </div>
          {badge}
        </header>
        {children}
      </div>
    </section>
  );
}
