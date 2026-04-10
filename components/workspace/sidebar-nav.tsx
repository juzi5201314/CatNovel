import type { AppMessages, SupportedLocale } from '../../lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Panel } from '../ui/panel';
import { SectionLabel } from '../ui/section-label';
import { t, type ChapterItem, type WorkItem } from './workspace-data';

export function SidebarNav({
  locale,
  copy,
  works,
  chapters,
  activeWorkId,
  activeChapterId,
  onWorkChange,
  onChapterChange,
}: {
  locale: SupportedLocale;
  copy: AppMessages;
  works: WorkItem[];
  chapters: ChapterItem[];
  activeWorkId: string;
  activeChapterId: string;
  onWorkChange: (workId: string) => void;
  onChapterChange: (chapterId: string) => void;
}) {
  return (
    <Panel
      id="work-panel"
      title={copy.workManager}
      subtitle="左栏承担作品/章节管理，不承载 layout mode 或 visual switch。"
      badge={<Badge tone="neutral">{copy.chapterSidebar}</Badge>}
    >
      <div className="nav-section">
        <SectionLabel>{copy.workManager}</SectionLabel>
        <div className="work-list">
          {works.map((work) => {
            const selected = work.id === activeWorkId;
            return (
              <button
                key={work.id}
                className={['work-card', selected ? 'work-card--active' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onWorkChange(work.id)}
                type="button"
              >
                <strong>{t(locale, work.label)}</strong>
                <p>{t(locale, work.summary)}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="nav-section">
        <SectionLabel>{copy.chapterManager}</SectionLabel>
        <div className="chapter-list">
          {chapters.map((chapter) => {
            const selected = chapter.id === activeChapterId;
            return (
              <button
                key={chapter.id}
                className={[
                  'chapter-item',
                  selected ? 'chapter-item--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onChapterChange(chapter.id)}
                type="button"
              >
                <div className="meta-row">
                  <strong>{t(locale, chapter.title)}</strong>
                  <Badge tone="neutral">{chapter.words}w</Badge>
                </div>
                <p>{t(locale, chapter.excerpt)}</p>
                <span className="mono-text">{chapter.updatedAt}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="nav-stack">
        <article className="nav-item">
          <SectionLabel>Settings context hooks</SectionLabel>
          <strong>{copy.settingsTree}</strong>
          <p>角色、地点、世界观、剧情与规则在右栏形成稳定树状入口。</p>
        </article>
        <article className="nav-item">
          <SectionLabel>Backup / restore / health</SectionLabel>
          <strong>{copy.snapshots}</strong>
          <p>保存状态、最近快照与 readiness 提醒统一留在当前 route 的锚点结构里。</p>
        </article>
      </div>
    </Panel>
  );
}
