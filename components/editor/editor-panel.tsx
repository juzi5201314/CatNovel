import type { AppMessages, SupportedLocale } from '../../lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Panel } from '../ui/panel';
import { Separator } from '../ui/separator';
import { t, type ChapterItem, slashCommands } from '../workspace/workspace-data';

const toolbarChips: Array<{
  key: keyof EditorModes;
  label: string;
}> = [
  { key: 'slash', label: 'Slash commands' },
  { key: 'bubble', label: 'Bubble menu' },
  { key: 'highlight', label: 'Search highlight' },
  { key: 'pageBreak', label: 'Page-break style' },
];

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
  editorModes,
  onToggleMode,
}: {
  locale: SupportedLocale;
  copy: AppMessages;
  chapter: ChapterItem;
  editorModes: EditorModes;
  onToggleMode: (mode: keyof EditorModes) => void;
}) {
  return (
    <Panel
      id="editor-panel"
      title="Primary writing stage"
      subtitle="中栏维持最高视觉权重，承接章节正文、slash/bubble/highlight/page-break 等交互表面。"
      badge={<Badge tone="neutral">Editor</Badge>}
    >
      <div className="editor-stage">
        <div className="editor-toolbar">
          {toolbarChips.map((chip) => (
            <button
              key={chip.key}
              className={[
                'toolbar-chip',
                editorModes[chip.key] ? 'toolbar-chip--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onToggleMode(chip.key)}
              type="button"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="editor-prose">
          <div className="editor-meta">
            <div>
              <span className="section-label">
                <span aria-hidden="true" className="section-label__dot" />
                {copy.editorTools}
              </span>
              <h2>{t(locale, chapter.title)}</h2>
            </div>
            <div className="chapter-stat-grid">
              <Card className="stat-card">
                <CardHeader className="stat-card__header">
                  <CardTitle className="stat-card__title">Words</CardTitle>
                </CardHeader>
                <CardContent className="stat-card__content">{chapter.words}</CardContent>
              </Card>
              <Card className="stat-card">
                <CardHeader className="stat-card__header">
                  <CardTitle className="stat-card__title">Updated</CardTitle>
                </CardHeader>
                <CardContent className="stat-card__content">{chapter.updatedAt}</CardContent>
              </Card>
            </div>
          </div>
          <p>
            {t(locale, chapter.excerpt)}
          </p>
          <p>
            她把设定树里最后一条
            <span className="editor-highlight"> 世界规则 </span>
            拖进上下文槽后，右栏的提示词突然安静下来。所有多余的模式开关都被拿掉，
            页面只剩下写作本身：左边是结构，中间是正文，右边是推理与帮助。
          </p>
          <p>
            这就是 lane-2 的职责——先把容器和节奏做对，再让章节、AI、快照沿着同一套
            shadow-border 语言长出来，而不是让功能在 dashboard 化的碎片里互相争抢。
          </p>
          <p>
            当后续 lane 接入真正的数据与交互时，这块区域仍然应该维持同样的排版密度、
            视觉节奏与专注感。
          </p>
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
                  <p>{t(locale, command.hint)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="command-card">
            <CardHeader>
              <CardTitle className="command-card__title">Bubble & preview</CardTitle>
            </CardHeader>
            <CardContent className="command-card__content">
              <div className="bubble-preview">
                <Badge tone={editorModes.bubble ? 'default' : 'neutral'}>
                  {editorModes.bubble ? 'Bubble menu on' : 'Bubble menu off'}
                </Badge>
                <Badge tone={editorModes.highlight ? 'default' : 'neutral'}>
                  {editorModes.highlight ? 'Highlight on' : 'Highlight off'}
                </Badge>
              </div>
              <p>
                当前表面为 worker-2 / worker-4 后续接入真正编辑器动作预留交互位置，
                但所有按钮已经在当前 route 内连成一条连续工作流。
              </p>
              <a className="button button--ghost button--anchor" href="#settings-panel">
                {copy.bookInfo}
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </Panel>
  );
}
