import { en } from './locales/en';
import { ru } from './locales/ru';
import { zh } from './locales/zh';

export const dictionaries = {
  zh,
  en,
  ru,
};

export type Locale = keyof typeof dictionaries;

export function getDictionary(locale: Locale = 'zh') {
  return dictionaries[locale];
}
