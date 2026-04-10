import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';
import { SectionLabel } from '../ui/section-label';

const helpTopics = [
  {
    title: '快捷键层',
    body: '把 slash command、bubble menu、搜索高亮、章节跳转的文案入口固定成单独 help surface。',
  },
  {
    title: '写作流程',
    body: '继续写 / 改写 / 润色 / 扩写 / 自由对话 会在这里给出逐项说明，避免用户迷路。',
  },
  {
    title: '运维提示',
    body: '备份、恢复、健康检查、readiness 都有明确入口，不再藏在外部文档里。',
  },
];

export function HelpPanel() {
  return (
    <Panel
      title="Help & guidance"
      subtitle="帮助容器作为长期存在的右栏 surface，而不是模糊弹窗。"
      badge={<Badge tone="neutral">Help</Badge>}
    >
      <div className="task-stack">
        {helpTopics.map((topic) => (
          <article key={topic.title} className="help-card">
            <SectionLabel>Guidance</SectionLabel>
            <strong>{topic.title}</strong>
            <p>{topic.body}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}
