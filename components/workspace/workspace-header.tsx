import type { AppMessages, SupportedLocale } from '../../lib/i18n/messages';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

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
    <header className="app-header">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 0L20 20H0L10 0Z" fill="currentColor"/>
          </svg>
          <span className="font-semibold text-sm">CatNovel</span>
        </div>
        <div className="h-4 w-[1px] bg-border mx-2" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{activeWorkLabel}</span>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm text-muted-foreground">{activeChapterTitle}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
          {(['zh', 'en', 'ru'] as SupportedLocale[]).map((entry) => (
            <button
              key={entry}
              className={[
                'px-2 py-1 text-xs rounded-sm transition-colors',
                entry === locale ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
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
        <Button variant="primary" size="sm">
          {copy.launchWriting}
        </Button>
      </div>
    </header>
  );
}
