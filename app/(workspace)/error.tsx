'use client';

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="error-state">
      <section className="error-card">
        <div className="eyebrow">Workspace shell error</div>
        <h1 className="workspace-title">工作台容器载入失败</h1>
        <p className="workspace-copy">{error.message || 'Unknown workspace error'}</p>
        <div className="workspace-actions">
          <button className="button button--primary" type="button" onClick={reset}>
            Retry shell
          </button>
        </div>
      </section>
    </main>
  );
}
