import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enSettings from '../locales/en_US/settings.json';
import zhSettings from '../locales/zh_CN/settings.json';

export type AppLanguage = 'en' | 'zh-CN';

export function appLanguage(value: string | null | undefined): AppLanguage {
  const source = !value || value === 'system' ? navigator.language : value;
  const normalized = source.trim().split('_').join('-').toLowerCase();
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh-CN';
  return 'en';
}

export function applyAppLanguage(value: string | null | undefined) {
  const next = appLanguage(value);
  if (i18n.resolvedLanguage !== next) void i18n.changeLanguage(next);
  return next;
}

void i18n.use(initReactI18next).init({
  resources: {
    'en': { settings: enSettings },
    'zh-CN': { settings: zhSettings },
  },
  lng: appLanguage(null),
  fallbackLng: 'en',
  supportedLngs: ['en', 'zh-CN'],
  ns: ['settings'],
  defaultNS: 'settings',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
