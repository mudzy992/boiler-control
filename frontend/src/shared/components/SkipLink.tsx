import { useTranslation } from 'react-i18next';

/**
 * WCAG 2.2 2.4.1 — first focusable control for keyboard users.
 */
export function SkipLink({ href = '#main-content' }: { href?: string }) {
  const { t } = useTranslation();
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 z-tooltip rounded-md bg-brand px-4 py-2 text-sm font-medium text-text-inverse ring-2 ring-brand ring-offset-2"
    >
      {t('shell.skipToContent')}
    </a>
  );
}
