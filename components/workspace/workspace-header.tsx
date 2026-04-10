import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

export function WorkspaceHeader() {
  return (
    <header className="workspace-header">
      <div className="workspace-brand">
        <div className="eyebrow">Author replica / lane 2 shell</div>
        <h1 className="workspace-title">CatNovel workspace</h1>
        <p className="workspace-copy">
          用 Vercel-like restraint 重建网文工作台：三栏连续布局、单主题设计系统、
          onboarding/help/settings 容器与后续 lane 的稳定挂载点。
        </p>
      </div>

      <div className="workspace-actions">
        <Badge>zh / en / ru</Badge>
        <Badge tone="neutral">SQLite is source of truth</Badge>
        <Button variant="ghost">Open help</Button>
        <Button variant="primary">Resume writing</Button>
      </div>
    </header>
  );
}
