import type { ChapterRecord, WorkspaceLocale } from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Panel } from '../ui/panel';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { slashCommands, t } from '../workspace/workspace-data';

export type EditorModes = {
  slash: boolean;
  bubble: boolean;
  highlight: boolean;
  pageBreak: boolean;
};

export function EditorPanel({
  locale,
  copy,
  chapter,
  body,
  draftTitle,
  editorModes,
  saveState,
  pendingGhostText,
  onTitleChange,
  onBodyChange,
  onToggleMode,
  onRunTask,
  onAcceptGhostText,
  onRejectGhostText,
}: {
  locale: WorkspaceLocale;
  copy: AppMessages;
  chapter: ChapterRecord | null;
  body: string;
  draftTitle: string;
  editorModes: EditorModes;
  saveState: string;
  pendingGhostText: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onToggleMode: (mode: keyof EditorModes) => void;
  onRunTask: (taskClass: '续写' | '改写' | '润色' | '扩写' | 'ghost-text') => void;
  onAcceptGhostText: () => void;
  onRejectGhostText: () => void;
}) {
  return (
    <Panel
      id="editor-panel"
      title="Primary writing stage"
      subtitle="中栏直接连接 SQLite autosave、slash tasks、ghost text 与章节指标。"
      badge={<Badge tone="neutral">Editor</Badge>}
    >
      <div className="editor-stage">
        <div className="editor-toolbar">
          {(
            [
              ['slash', 'Slash commands'],
              ['bubble', 'Bubble menu'],
              ['highlight', 'Search highlight'],
              ['pageBreak', 'Page-break style'],
            ] as Array<[keyof EditorModes, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              className={[
                'toolbar-chip',
                editorModes[key] ? 'toolbar-chip--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onToggleMode(key)}
              type="button"
            >
              {label}
            </button>
          ))}
          <Badge tone="neutral">{saveState}</Badge>
        </div>

        <div className="editor-prose">
          <div className="editor-meta">
            <div className="task-stack">
              <span className="section-label">
                <span aria-hidden="true" className="section-label__dot" />
                {copy.editorTools}
              </span>
              <Input value={draftTitle} onChange={(event) => onTitleChange(event.target.value)} />
            </div>
            <div className="chapter-stat-grid">
              <Card className="stat-card">
                <CardHeader className="stat-card__header">
                  <CardTitle className="stat-card__title">Words</CardTitle>
                </CardHeader>
                <CardContent className="stat-card__content">{chapter?.wordCount ?? 0}</CardContent>
              </Card>
              <Card className="stat-card">
                <CardHeader className="stat-card__header">
                  <CardTitle className="stat-card__title">Chars</CardTitle>
                </CardHeader>
                <CardContent className="stat-card__content">
                  {chapter?.characterCount ?? 0}
                </CardContent>
              </Card>
              <Card className="stat-card">
                <CardHeader className="stat-card__header">
                  <CardTitle className="stat-card__title">Read</CardTitle>
                </CardHeader>
                <CardContent className="stat-card__content">
                  {chapter?.readingMinutes ?? 0}m
                </CardContent>
              </Card>
              <Card className="stat-card">
                <CardHeader className="stat-card__header">
                  <CardTitle className="stat-card__title">Autosave</CardTitle>
                </CardHeader>
                <CardContent className="stat-card__content">
                  {chapter?.lastAutosavedAt ?? '—'}
                </CardContent>
              </Card>
            </div>
          </div>

          <Textarea
            rows={18}
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
          />

          {editorModes.highlight ? (
            <p>
              {locale === 'zh'
                ? '高亮模式已开启：当前章节中的设定引用会在 AI 上下文与正文之间保持可见。'
                : locale === 'en'
                  ? 'Highlight mode is on: setting references stay visible between the editor and AI context.'
                  : 'Режим подсветки включён: ссылки на сеттинг видны и в редакторе, и в AI-контексте.'}
            </p>
          ) : null}

          {editorModes.pageBreak ? <div className="page-break-rule" /> : null}
        </div>

        <Separator />

        <div className="editor-command-grid">
          <Card className="command-card">
            <CardHeader>
              <CardTitle className="command-card__title">Slash surface</CardTitle>
            </CardHeader>
            <CardContent className="command-card__content">
              {slashCommands.map((command) => (
                <div key={command.id} className="command-row">
                  <strong>{t(locale, command.label)}</strong>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      onRunTask(command.id as '续写' | '改写' | '润色' | '扩写' | 'ghost-text')
                    }
                  >
                    {locale === 'zh' ? '执行' : locale === 'en' ? 'Run' : 'Запустить'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="command-card">
            <CardHeader>
              <CardTitle className="command-card__title">Ghost text</CardTitle>
            </CardHeader>
            <CardContent className="command-card__content">
              <p>{pendingGhostText || '—'}</p>
              <div className="snapshot-actions">
                <Button variant="ghost" onClick={onAcceptGhostText}>
                  {locale === 'zh' ? '接受' : locale === 'en' ? 'Accept' : 'Принять'}
                </Button>
                <Button variant="ghost" onClick={onRejectGhostText}>
                  {locale === 'zh' ? '拒绝' : locale === 'en' ? 'Reject' : 'Отклонить'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Panel>
  );
}
