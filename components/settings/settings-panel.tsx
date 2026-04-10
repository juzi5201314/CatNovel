import type { AppMessages, SupportedLocale } from '../../lib/i18n/messages';

import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Panel } from '../ui/panel';
import { SectionLabel } from '../ui/section-label';
import { Textarea } from '../ui/textarea';
import { t, type SettingNode } from '../workspace/workspace-data';

export function SettingsPanel({
  locale,
  copy,
  nodes,
  activeNodeId,
  activeNodeHint,
  bookFields,
  onNodeChange,
}: {
  locale: SupportedLocale;
  copy: AppMessages;
  nodes: SettingNode[];
  activeNodeId: string;
  activeNodeHint: string;
  bookFields: Array<{ key: string; label: string; value: string }>;
  onNodeChange: (id: string) => void;
}) {
  return (
    <Panel
      id="settings-panel"
      title={copy.settingsTree}
      subtitle="设定树与书籍信息在同一面板内协作，只承载 webnovel 契约。"
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
              <SectionLabel>Webnovel only</SectionLabel>
              <strong>{t(locale, node.label)}</strong>
              <p>{t(locale, node.hint)}</p>
            </button>
          ))}
        </div>

        <div className="settings-grid">
          <article className="settings-card">
            <SectionLabel>{copy.bookInfo}</SectionLabel>
            <div className="book-info-form">
              {bookFields.slice(0, 2).map((field) => (
                <label key={field.key} className="field-group">
                  <span className="field-label">{field.label}</span>
                  <Input readOnly value={field.value} />
                </label>
              ))}
              <label className="field-group">
                <span className="field-label">{bookFields[2]?.label}</span>
                <Textarea readOnly rows={4} value={bookFields[2]?.value} />
              </label>
              <label className="field-group">
                <span className="field-label">{bookFields[3]?.label}</span>
                <Input readOnly value={bookFields[3]?.value} />
              </label>
            </div>
          </article>

          <article className="settings-card">
            <SectionLabel>{copy.settingsTree}</SectionLabel>
            <h4>{copy.bookInfo}</h4>
            <p>{activeNodeHint}</p>
          </article>
        </div>
      </div>
    </Panel>
  );
}
