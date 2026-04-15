import type { SupportedLocale } from '../../lib/i18n/messages';

const localeLabels: Record<SupportedLocale, string> = {
  zh: '简体中文',
  en: 'English',
  ru: 'Русский',
};

export function WorkspaceHeader({
  locale,
  activeWorkLabel,
  activeChapterTitle,
  onLocaleChange,
}: {
  locale: SupportedLocale;
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
        <div className="relative">
          <select
            value={locale}
            onChange={(e) => onLocaleChange(e.target.value as SupportedLocale)}
            className="input h-8 text-xs w-32 appearance-none cursor-pointer pr-8"
          >
            {(['zh', 'en', 'ru'] as SupportedLocale[]).map((entry) => (
              <option key={entry} value={entry}>
                {localeLabels[entry]}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </header>
  );
}
