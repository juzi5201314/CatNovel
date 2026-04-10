import type { ReactNode } from 'react';

export function Panel({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="surface">
      <div className="surface__body">
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
