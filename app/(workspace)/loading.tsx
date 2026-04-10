export default function Loading() {
  return (
    <main className="loading-state">
      <div className="loading-card">
        <div className="eyebrow">Workspace shell</div>
        <h1 className="workspace-title">正在装配写作工作台</h1>
        <p className="workspace-copy">
          载入三栏布局、设计 token 与 onboarding/help/settings 容器。
        </p>
        <div className="loading-pulse" aria-hidden="true" />
      </div>
    </main>
  );
}
