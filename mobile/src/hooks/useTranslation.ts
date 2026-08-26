import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * Custom hook for translations
 * Usage: const { t } = useTranslation();
 *        const title = t('dashboard.title');
 */
export function useTranslation() {
  return useI18nTranslation();
}
