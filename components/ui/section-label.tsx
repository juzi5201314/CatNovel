export function SectionLabel({ children }: { children: string }) {
  return (
    <span className="section-label">
      <span aria-hidden="true" className="section-label__dot" />
      {children}
    </span>
  );
}
