import { useTranslation as useI18nTranslation } from 'react-i18next';

// Stranice koje koriste `t()` van `App.tsx` (npr. u testovima koji renderuju
// ekran samostalno) inače rade s neinicijalizovanim i18n instancom i vraćaju
// goli ključ. `config.ts` je idempotentan pri ponovnom importu, pa ga ovdje
// čitamo kao nuspojavu — `App.tsx` ga ionako uvozi prvi.
import '../locales/config';

/**
 * Custom hook for translations
 * Usage: const { t } = useTranslation();
 *        const title = t('dashboard.title');
 */
export function useTranslation() {
  return useI18nTranslation();
}
