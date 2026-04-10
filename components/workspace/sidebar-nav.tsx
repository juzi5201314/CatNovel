import type {
  ChapterRecord,
  VolumeRecord,
  WorkRecord,
  WorkspaceLocale,
} from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Panel } from '../ui/panel';
import { SectionLabel } from '../ui/section-label';
import { parseChapterText } from './workspace-data';

export function SidebarNav({
  copy,
  locale,
  works,
  volumes,
  chapters,
  activeWorkId,
  activeChapterId,
  draftWorkTitle,
  draftVolumeTitle,
  draftChapterTitle,
  onWorkTitleChange,
  onVolumeTitleChange,
  onChapterTitleChange,
  onWorkChange,
  onChapterChange,
  onCreateWork,
  onCreateVolume,
  onCreateChapter,
}: {
  copy: AppMessages;
  locale: WorkspaceLocale;
  works: WorkRecord[];
  volumes: VolumeRecord[];
  chapters: ChapterRecord[];
  activeWorkId: string;
  activeChapterId: string;
  draftWorkTitle: string;
  draftVolumeTitle: string;
  draftChapterTitle: string;
  onWorkTitleChange: (value: string) => void;
  onVolumeTitleChange: (value: string) => void;
  onChapterTitleChange: (value: string) => void;
  onWorkChange: (workId: string) => void;
  onChapterChange: (chapterId: string) => void;
  onCreateWork: () => void;
  onCreateVolume: () => void;
  onCreateChapter: () => void;
}) {
  return (
    <Panel
      id="work-panel"
      title={copy.workManager}
      subtitle="作品 / 分卷 / 章节都从 SQLite 读取并在当前工作台内直接维护。"
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
                <strong>{work.title}</strong>
                <p>{work.synopsis || (locale === 'zh' ? '暂无简介' : locale === 'en' ? 'No synopsis yet' : 'Пока без синопсиса')}</p>
              </button>
            );
          })}
        </div>
        <div className="task-stack">
          <Input
            value={draftWorkTitle}
            onChange={(event) => onWorkTitleChange(event.target.value)}
            placeholder={locale === 'zh' ? '新作品标题' : locale === 'en' ? 'New work title' : 'Новое название проекта'}
          />
          <Button variant="ghost" onClick={onCreateWork}>
            {locale === 'zh' ? '创建作品' : locale === 'en' ? 'Create work' : 'Создать проект'}
          </Button>
        </div>
      </div>

      <div className="nav-section">
        <SectionLabel>{copy.chapterManager}</SectionLabel>
        <div className="task-stack">
          <Input
            value={draftVolumeTitle}
            onChange={(event) => onVolumeTitleChange(event.target.value)}
            placeholder={locale === 'zh' ? '新分卷标题' : locale === 'en' ? 'New volume title' : 'Новый том'}
          />
          <Button variant="ghost" onClick={onCreateVolume}>
            {locale === 'zh' ? '新增分卷' : locale === 'en' ? 'Add volume' : 'Добавить том'}
          </Button>
        </div>
        <div className="chapter-list">
          {volumes.map((volume) => (
            <article key={volume.id} className="nav-item">
              <div className="meta-row">
                <strong>{volume.title}</strong>
                <Badge tone="neutral">{volume.sortIndex + 1}</Badge>
              </div>
              <div className="task-stack">
                {chapters
                  .filter((chapter) => chapter.volumeId === volume.id)
                  .map((chapter) => {
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
                          <strong>{chapter.title}</strong>
                          <Badge tone="neutral">{chapter.wordCount}w</Badge>
                        </div>
                        <p>{chapter.excerpt || parseChapterText(chapter.bodyJson).slice(0, 96)}</p>
                        <span className="mono-text">
                          {chapter.lastAutosavedAt ?? chapter.updatedAt}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </article>
          ))}
        </div>
        <div className="task-stack">
          <Input
            value={draftChapterTitle}
            onChange={(event) => onChapterTitleChange(event.target.value)}
            placeholder={locale === 'zh' ? '新章节标题' : locale === 'en' ? 'New chapter title' : 'Новая глава'}
          />
          <Button variant="ghost" onClick={onCreateChapter}>
            {locale === 'zh' ? '新增章节' : locale === 'en' ? 'Add chapter' : 'Добавить главу'}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
