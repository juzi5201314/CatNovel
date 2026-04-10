import type {
  BookMetadataRecord,
  SettingNodeRecord,
  SettingNodeType,
  WorkspaceLocale,
} from '@/lib/contracts/workspace';
import type { AppMessages } from '@/lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Panel } from '../ui/panel';
import { SectionLabel } from '../ui/section-label';
import { Textarea } from '../ui/textarea';
import {
  parseSettingSummary,
  settingTypeLabels,
  t,
} from '../workspace/workspace-data';

export function SettingsPanel({
  locale,
  copy,
  nodes,
  activeNodeId,
  activeNodeTitle,
  activeNodeSummary,
  draftNodeTitle,
  draftNodeType,
  metadata,
  onNodeChange,
  onDraftNodeTitleChange,
  onDraftNodeTypeChange,
  onCreateNode,
  onActiveNodeTitleChange,
  onActiveNodeSummaryChange,
  onSaveNode,
  onDeleteNode,
  onMetadataChange,
  onSaveMetadata,
}: {
  locale: WorkspaceLocale;
  copy: AppMessages;
  nodes: SettingNodeRecord[];
  activeNodeId: string | null;
  activeNodeTitle: string;
  activeNodeSummary: string;
  draftNodeTitle: string;
  draftNodeType: SettingNodeType;
  metadata: BookMetadataRecord | null;
  onNodeChange: (id: string) => void;
  onDraftNodeTitleChange: (value: string) => void;
  onDraftNodeTypeChange: (value: SettingNodeType) => void;
  onCreateNode: () => void;
  onActiveNodeTitleChange: (value: string) => void;
  onActiveNodeSummaryChange: (value: string) => void;
  onSaveNode: () => void;
  onDeleteNode: () => void;
  onMetadataChange: (
    field: keyof Omit<BookMetadataRecord, 'workId' | 'updatedAt'>,
    value: string,
  ) => void;
  onSaveMetadata: () => void;
}) {
  return (
    <Panel
      id="settings-panel"
      title={copy.settingsTree}
      subtitle="设定树节点与书籍信息统一持久化到 SQLite。"
      badge={<Badge tone="neutral">Settings</Badge>}
    >
      <div className="settings-layout">
        <div className="tree-nav">
          {nodes.map((node) => (
            <button
              key={node.id}
              className={[
                'tree-node',
                node.id === activeNodeId ? 'tree-node--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onNodeChange(node.id)}
              type="button"
            >
              <SectionLabel>{t(locale, settingTypeLabels[node.nodeType])}</SectionLabel>
              <strong>{node.title}</strong>
              <p>{parseSettingSummary(node.payloadJson) || '—'}</p>
            </button>
          ))}
          <article className="settings-card">
            <SectionLabel>
              {locale === 'zh' ? '新增节点' : locale === 'en' ? 'New node' : 'Новый узел'}
            </SectionLabel>
            <Input
              value={draftNodeTitle}
              onChange={(event) => onDraftNodeTitleChange(event.target.value)}
              placeholder={locale === 'zh' ? '节点标题' : locale === 'en' ? 'Node title' : 'Название узла'}
            />
            <select
              className="input-shell"
              value={draftNodeType}
              onChange={(event) => onDraftNodeTypeChange(event.target.value as SettingNodeType)}
            >
              {Object.entries(settingTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {t(locale, label)}
                </option>
              ))}
            </select>
            <Button variant="ghost" onClick={onCreateNode}>
              {locale === 'zh' ? '创建设定节点' : locale === 'en' ? 'Create setting node' : 'Создать узел'}
            </Button>
          </article>
        </div>

        <div className="settings-grid">
          <article className="settings-card">
            <SectionLabel>{copy.bookInfo}</SectionLabel>
            <div className="book-info-form">
              <label className="field-group">
                <span className="field-label">
                  {locale === 'zh' ? '作者名' : locale === 'en' ? 'Author' : 'Автор'}
                </span>
                <Input
                  value={metadata?.authorName ?? ''}
                  onChange={(event) => onMetadataChange('authorName', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span className="field-label">
                  {locale === 'zh' ? '目标读者' : locale === 'en' ? 'Audience' : 'Аудитория'}
                </span>
                <Input
                  value={metadata?.targetReaders ?? ''}
                  onChange={(event) => onMetadataChange('targetReaders', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span className="field-label">
                  {locale === 'zh' ? '连载状态' : locale === 'en' ? 'Serial status' : 'Статус'}
                </span>
                <Input
                  value={metadata?.serializedStatus ?? ''}
                  onChange={(event) => onMetadataChange('serializedStatus', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span className="field-label">
                  {locale === 'zh' ? '标签 JSON' : locale === 'en' ? 'Tags JSON' : 'Теги JSON'}
                </span>
                <Input
                  value={metadata?.tagsJson ?? '[]'}
                  onChange={(event) => onMetadataChange('tagsJson', event.target.value)}
                />
              </label>
              <label className="field-group">
                <span className="field-label">
                  {locale === 'zh' ? '故事简介' : locale === 'en' ? 'Premise' : 'Синопсис'}
                </span>
                <Textarea
                  rows={4}
                  value={metadata?.premise ?? ''}
                  onChange={(event) => onMetadataChange('premise', event.target.value)}
                />
              </label>
              <Button variant="ghost" onClick={onSaveMetadata}>
                {locale === 'zh' ? '保存书籍信息' : locale === 'en' ? 'Save book info' : 'Сохранить данные книги'}
              </Button>
            </div>
          </article>

          <article className="settings-card">
            <SectionLabel>{copy.settingsTree}</SectionLabel>
            <Input
              value={activeNodeTitle}
              onChange={(event) => onActiveNodeTitleChange(event.target.value)}
              placeholder={locale === 'zh' ? '节点标题' : locale === 'en' ? 'Node title' : 'Название узла'}
            />
            <Textarea
              rows={6}
              value={activeNodeSummary}
              onChange={(event) => onActiveNodeSummaryChange(event.target.value)}
              placeholder={locale === 'zh' ? '节点摘要与上下文信息' : locale === 'en' ? 'Node summary' : 'Сводка узла'}
            />
            <div className="snapshot-actions">
              <Button variant="ghost" onClick={onSaveNode}>
                {locale === 'zh' ? '保存节点' : locale === 'en' ? 'Save node' : 'Сохранить узел'}
              </Button>
              <Button variant="ghost" onClick={onDeleteNode}>
                {locale === 'zh' ? '删除节点' : locale === 'en' ? 'Delete node' : 'Удалить узел'}
              </Button>
            </div>
          </article>
        </div>
      </div>
    </Panel>
  );
}
