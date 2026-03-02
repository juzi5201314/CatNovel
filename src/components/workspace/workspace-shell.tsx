type PlaceholderCardProps = {
  title: string;
  description: string;
};

function PlaceholderCard({ title, description }: PlaceholderCardProps) {
  return (
    <article className="cn-panel cn-panel-soft">
      <h3 className="cn-card-title">{title}</h3>
      <p className="cn-card-description">{description}</p>
    </article>
  );
}

export function WorkspaceShell() {
  return (
    <main className="cn-workspace">
      <section className="cn-column cn-column-left">
        <header className="cn-column-header">
          <h2>Project</h2>
          <span>0 项</span>
        </header>
        <PlaceholderCard
          title="项目列表占位"
          description="W2 会接入项目 CRUD 与章节树。"
        />
      </section>

      <section className="cn-column cn-column-editor">
        <header className="cn-column-header">
          <h2>Editor</h2>
          <span>准备就绪</span>
        </header>
        <div className="cn-editor-placeholder">
          <h1>CatNovel Workspace</h1>
          <p>三栏骨架已就位，后续波次将接入 TipTap 与 AI 侧栏。</p>
        </div>
      </section>

      <section className="cn-column cn-column-right">
        <header className="cn-column-header">
          <h2>Assistant</h2>
          <span>未连接</span>
        </header>
        <PlaceholderCard
          title="AI 侧栏占位"
          description="W3 会接入流式消息、Ghost Text 与工具审批通知。"
        />
      </section>
    </main>
  );
}
