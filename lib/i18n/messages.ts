export const supportedLocales = ["zh", "en", "ru"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const messages = {
  zh: {
    foundationBadge: "foundation lane",
    launchWriting: "启动创作",
    chapterSidebar: "章节栏",
    aiSidebar: "AI 栏",
    workspaceError: "无法完成工作台启动",
    workspaceErrorRetry: "重试",
    workspaceLoading: "正在初始化工作台…",
    localeSwitcher: "界面语言",
    workManager: "作品管理",
    chapterManager: "章节管理",
    editorTools: "编辑交互",
    settingsTree: "设定树",
    bookInfo: "书籍信息",
    snapshots: "快照面板",
    helpLabel: "帮助与快捷键",
  },
  en: {
    foundationBadge: "foundation lane",
    launchWriting: "Start writing",
    chapterSidebar: "Chapters",
    aiSidebar: "AI panel",
    workspaceError: "Workspace failed to boot",
    workspaceErrorRetry: "Retry",
    workspaceLoading: "Bootstrapping workspace…",
    localeSwitcher: "Interface locale",
    workManager: "Work manager",
    chapterManager: "Chapter manager",
    editorTools: "Editor interactions",
    settingsTree: "Settings tree",
    bookInfo: "Book info",
    snapshots: "Snapshots panel",
    helpLabel: "Help and shortcuts",
  },
  ru: {
    foundationBadge: "foundation lane",
    launchWriting: "Начать писать",
    chapterSidebar: "Главы",
    aiSidebar: "AI панель",
    workspaceError: "Не удалось запустить рабочее пространство",
    workspaceErrorRetry: "Повторить",
    workspaceLoading: "Инициализация рабочего пространства…",
    localeSwitcher: "Язык интерфейса",
    workManager: "Управление проектами",
    chapterManager: "Управление главами",
    editorTools: "Интерактив редактора",
    settingsTree: "Дерево настроек",
    bookInfo: "Информация о книге",
    snapshots: "Панель снимков",
    helpLabel: "Помощь и шорткаты",
  },
} as const;

export type AppMessages = (typeof messages)[SupportedLocale];

export function resolveMessages(locale: string) {
  if (locale in messages) {
    return messages[locale as SupportedLocale];
  }

  return messages.zh;
}
