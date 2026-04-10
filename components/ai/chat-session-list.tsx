import { Badge } from '../ui/badge';
import { SectionLabel } from '../ui/section-label';

const chatSessions = [
  {
    title: '剧情打磨',
    summary: '聚焦冲突升级与章节节奏，保留最近一次 ghost text 接受位。',
  },
  {
    title: '设定校对',
    summary: '检查角色境界、势力关系与世界规则是否自洽。',
  },
  {
    title: '自由对话',
    summary: '给作者一个不脱离正文上下文的 sidecar conversation surface。',
  },
];

export function ChatSessionList() {
  return (
    <div className="chat-session-list">
      {chatSessions.map((session, index) => (
        <article key={session.title} className="chat-session-card">
          <div className="meta-row">
            <SectionLabel>{`Session 0${index + 1}`}</SectionLabel>
            <Badge tone="neutral">persisted</Badge>
          </div>
          <strong>{session.title}</strong>
          <p>{session.summary}</p>
        </article>
      ))}
    </div>
  );
}
