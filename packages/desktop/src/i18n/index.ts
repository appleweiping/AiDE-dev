import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './en.json';
import zhCN from './zh-CN.json';
import ja from './ja.json';
import ko from './ko.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-CN': { translation: zhCN },
      ja: { translation: ja },
      ko: { translation: ko },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh-CN', 'ja', 'ko'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'aide-language',
      caches: ['localStorage'],
    },
  });

export default i18n;
