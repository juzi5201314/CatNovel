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
  },
  en: {
    foundationBadge: "foundation lane",
    launchWriting: "Start writing",
    chapterSidebar: "Chapters",
    aiSidebar: "AI panel",
    workspaceError: "Workspace failed to boot",
    workspaceErrorRetry: "Retry",
    workspaceLoading: "Bootstrapping workspace…",
  },
  ru: {
    foundationBadge: "foundation lane",
    launchWriting: "Начать писать",
    chapterSidebar: "Главы",
    aiSidebar: "AI панель",
    workspaceError: "Не удалось запустить рабочее пространство",
    workspaceErrorRetry: "Повторить",
    workspaceLoading: "Инициализация рабочего пространства…",
  },
} as const;

export type AppMessages = (typeof messages)[SupportedLocale];

export function resolveMessages(locale: string) {
  if (locale in messages) {
    return messages[locale as SupportedLocale];
  }

  return messages.zh;
}
