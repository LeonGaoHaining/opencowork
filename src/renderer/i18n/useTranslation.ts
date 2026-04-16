import { useTranslation as useI18nTranslation } from 'react-i18next';

export function useTranslation() {
  const { t, i18n } = useI18nTranslation();

  const switchLanguage = (lang: 'zh' | 'en') => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const getCurrentLanguage = (): 'zh' | 'en' => {
    return (i18n.language as 'zh' | 'en') || 'en';
  };

  return {
    t,
    switchLanguage,
    language: getCurrentLanguage(),
  };
}
