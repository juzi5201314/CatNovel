import type { AppMessages, SupportedLocale } from '../../lib/i18n/messages';

import { Badge } from '../ui/badge';

const localeLabels: Record<SupportedLocale, string> = {
  zh: '简体中文',
  en: 'English',
  ru: 'Русский',
};

export function WorkspaceHeader({
  locale,
  copy,
  activeWorkLabel,
  activeChapterTitle,
  onLocaleChange,
}: {
  locale: SupportedLocale;
  copy: AppMessages;
  activeWorkLabel: string;
  activeChapterTitle: string;
  onLocaleChange: (locale: SupportedLocale) => void;
}) {
  return (
    <header className="workspace-header">
      <div className="workspace-brand">
        <div className="eyebrow">Author replica / production cutover</div>
        <h1 className="workspace-title">CatNovel workspace</h1>
        <p className="workspace-copy">
          {activeWorkLabel} · {activeChapterTitle}
          。三栏连续布局、单主题设计系统、SQLite 单一事实源、AI /
          snapshots / settings / help 共用同一路由，不保留 theme、
          layout mode 或云同步旁路。
        </p>
      </div>

      <div className="workspace-actions">
        <div className="locale-switcher" aria-label={copy.localeSwitcher}>
          {(['zh', 'en', 'ru'] as SupportedLocale[]).map((entry) => (
            <button
              key={entry}
              className={[
                'locale-button',
                entry === locale ? 'locale-button--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onLocaleChange(entry)}
              type="button"
            >
              {localeLabels[entry]}
            </button>
          ))}
        </div>
        <Badge>{copy.localeSwitcher}</Badge>
        <Badge tone="neutral">SQLite is source of truth</Badge>
        <a className="button button--ghost button--anchor" href="#help-panel">
          Open help
        </a>
        <a className="button button--primary button--anchor" href="#editor-panel">
          {copy.launchWriting}
        </a>
      </div>
    </header>
  );
}
