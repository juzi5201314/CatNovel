import type { SupportedLocale } from "../../lib/i18n/messages";

export type LocaleText = Record<SupportedLocale, string>;

export type WorkItem = {
  id: string;
  label: LocaleText;
  summary: LocaleText;
};

export type ChapterItem = {
  id: string;
  workId: string;
  title: LocaleText;
  excerpt: LocaleText;
  words: number;
  updatedAt: string;
};

export type SettingNode = {
  id: string;
  label: LocaleText;
  hint: LocaleText;
};

export type BookField = {
  key: string;
  label: LocaleText;
  value: LocaleText;
};

export const works: WorkItem[] = [
  {
    id: "work-immortal",
    label: {
      zh: "《雾海升阶录》",
      en: "Mist Sea Ascension",
      ru: "Летопись Туманного Моря",
    },
    summary: {
      zh: "修真连载主线，当前推进到第二卷高潮。",
      en: "Primary cultivation serial, entering the second-volume climax.",
      ru: "Главная культивационная серия, входит в кульминацию второго тома.",
    },
  },
  {
    id: "work-city",
    label: {
      zh: "《凌晨四点的副本》",
      en: "Raid at 4 A.M.",
      ru: "Рейд в четыре утра",
    },
    summary: {
      zh: "都市系统流支线，保留作息与副本节奏设定。",
      en: "Urban system-flow side project with rhythm and instance rules preserved.",
      ru: "Городская ветка с системой и жёстким ритмом подземелий.",
    },
  },
];

export const chapters: ChapterItem[] = [
  {
    id: "chapter-23",
    workId: "work-immortal",
    title: {
      zh: "第二十三章：月潮越过书脊",
      en: "Chapter 23: Moon Tide Over the Spine",
      ru: "Глава 23: Лунный прилив над корешком",
    },
    excerpt: {
      zh: "她把最后一条世界规则拖进上下文槽后，右栏终于安静了下来。",
      en: "Once she dragged the final world rule into context, the right rail finally fell quiet.",
      ru: "Когда она перетащила последнее правило мира в контекст, правая колонка наконец стихла.",
    },
    words: 4821,
    updatedAt: "5m ago",
  },
  {
    id: "chapter-24",
    workId: "work-immortal",
    title: {
      zh: "第二十四章：城门前的算法雪",
      en: "Chapter 24: Algorithm Snow at the City Gate",
      ru: "Глава 24: Алгоритмический снег у городских ворот",
    },
    excerpt: {
      zh: "旧的誓约像雪一样落下，给每个角色都盖了一层冷白色的命运。",
      en: "Old vows fell like snow, coating every character in a cold white fate.",
      ru: "Старые клятвы посыпались снегом и покрыли каждого героя холодной белизной судьбы.",
    },
    words: 3158,
    updatedAt: "42m ago",
  },
  {
    id: "chapter-06",
    workId: "work-city",
    title: {
      zh: "第六章：副本开门前的便利店灯",
      en: "Chapter 6: Convenience Store Lights Before the Raid",
      ru: "Глава 6: Свет круглосуточного магазина перед рейдом",
    },
    excerpt: {
      zh: "主角在副本刷新前把装备清单又检查了一遍，像查收第二天的命运。",
      en: "The lead checked the equipment list one more time before reset, like signing for tomorrow’s fate.",
      ru: "Перед обновлением рейда герой ещё раз проверил снаряжение, словно расписывался за судьбу завтрашнего дня.",
    },
    words: 1887,
    updatedAt: "1h ago",
  },
];

export const settingNodes: SettingNode[] = [
  {
    id: "setting-characters",
    label: {
      zh: "角色群像",
      en: "Character ensemble",
      ru: "Ансамбль персонажей",
    },
    hint: {
      zh: "主角、反派、盟友与宿敌的动机曲线。",
      en: "Motivation arcs for lead, rival, allies, and nemesis.",
      ru: "Мотивационные дуги героя, соперника, союзников и антагониста.",
    },
  },
  {
    id: "setting-world",
    label: {
      zh: "世界规则",
      en: "World rules",
      ru: "Правила мира",
    },
    hint: {
      zh: "力量体系、资源约束与禁忌条款。",
      en: "Power system, resource constraints, and taboo clauses.",
      ru: "Система силы, ресурсные ограничения и табу.",
    },
  },
  {
    id: "setting-plot",
    label: {
      zh: "剧情主轴",
      en: "Plot spine",
      ru: "Сюжетный стержень",
    },
    hint: {
      zh: "主线冲突、支线节奏与下一次高潮点。",
      en: "Main conflict, side-thread pacing, and the next climax.",
      ru: "Главный конфликт, ритм боковых линий и следующая кульминация.",
    },
  },
];

export const bookFields: BookField[] = [
  {
    key: "title",
    label: {
      zh: "作品标题",
      en: "Book title",
      ru: "Название книги",
    },
    value: {
      zh: "雾海升阶录",
      en: "Mist Sea Ascension",
      ru: "Летопись Туманного Моря",
    },
  },
  {
    key: "genre",
    label: {
      zh: "题材类型",
      en: "Genre",
      ru: "Жанр",
    },
    value: {
      zh: "修真 / 连载 / 升级流",
      en: "Cultivation / serial / progression fantasy",
      ru: "Культивация / сериал / progression fantasy",
    },
  },
  {
    key: "synopsis",
    label: {
      zh: "故事简介",
      en: "Synopsis",
      ru: "Синопсис",
    },
    value: {
      zh: "少女在雾海边缘捡到一枚会重写因果的旧印，从此被迫以连载速度改写世界秩序。",
      en: "A young woman finds a seal that rewrites causality at the mist sea edge and is forced to reshape the world at serial speed.",
      ru: "Девушка находит печать, переписывающую причинность, и вынуждена менять порядок мира в ритме ежедневной публикации.",
    },
  },
  {
    key: "tone",
    label: {
      zh: "整体基调",
      en: "Tone",
      ru: "Тональность",
    },
    value: {
      zh: "冷白、克制、带一点神性机械感",
      en: "Cool white, restrained, with a faint sacred-mechanical edge",
      ru: "Холодная белизна, сдержанность и лёгкая сакральная механика",
    },
  },
];

export const slashCommands: Array<{ id: string; label: LocaleText; hint: LocaleText }> =
  [
    {
      id: "continue",
      label: {
        zh: "/续写",
        en: "/continue",
        ru: "/продолжить",
      },
      hint: {
        zh: "延续当前段落节奏",
        en: "Continue the current scene rhythm",
        ru: "Продолжить ритм текущей сцены",
      },
    },
    {
      id: "rewrite",
      label: {
        zh: "/改写",
        en: "/rewrite",
        ru: "/переписать",
      },
      hint: {
        zh: "重组语气与结构",
        en: "Reshape tone and structure",
        ru: "Перестроить тон и структуру",
      },
    },
    {
      id: "polish",
      label: {
        zh: "/润色",
        en: "/polish",
        ru: "/отшлифовать",
      },
      hint: {
        zh: "压实措辞与节拍",
        en: "Tighten wording and pacing",
        ru: "Уплотнить лексику и темп",
      },
    },
  ];

export function t(locale: SupportedLocale, text: LocaleText) {
  return text[locale];
}

