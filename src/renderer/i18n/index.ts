import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zh from './zh.json';
import en from './en.json';

const resources = {
  zh: { translation: zh },
  en: { translation: en },
};

// Detect language from localStorage or system
const getInitialLanguage = (): 'zh' | 'en' => {
  // First check localStorage
  const saved = localStorage.getItem('language');
  if (saved === 'zh' || saved === 'en') return saved;

  // Then check system language
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  return 'en';
};

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
