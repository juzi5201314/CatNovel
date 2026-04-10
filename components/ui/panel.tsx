import type { ReactNode } from 'react';

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
    <section className={["surface", className].filter(Boolean).join(" ")} id={id}>
      <div className={["surface__body", bodyClassName].filter(Boolean).join(" ")}>
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
