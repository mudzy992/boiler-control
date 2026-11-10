export interface ShellNavItem {
  readonly key: string;
  readonly href: string;
  readonly labelKey: string;
  /**
   * `F15`: stavka vidljiva samo administratoru. Server i dalje provjerava
   * `ADMIN` (`RolesGuard`) — skrivanje u meniju je UX, ne zaštita.
   */
  readonly adminOnly?: boolean;
}

/** Nine operational routes — visible to USER, SUPPORT, and ADMIN (Q6). */
export const SHELL_NAV_ITEMS: readonly ShellNavItem[] = [
  { key: 'dashboard', href: '/dashboard', labelKey: 'nav.dashboard' },
  { key: 'boiler', href: '/boiler', labelKey: 'nav.boiler' },
  { key: 'heating', href: '/heating', labelKey: 'nav.heating' },
  { key: 'gas-readings', href: '/gas/readings', labelKey: 'nav.gasReadings' },
  { key: 'gas-analytics', href: '/gas/analytics', labelKey: 'nav.gasAnalytics' },
  { key: 'reports', href: '/reports', labelKey: 'nav.reports' },
  { key: 'home-profile', href: '/home-profile', labelKey: 'nav.homeProfile' },
  { key: 'notifications', href: '/notifications', labelKey: 'nav.notifications' },
  { key: 'profile', href: '/profile', labelKey: 'nav.profile' },
] as const;

/** Stavke koje se prikazuju samo administratoru (`F15`: objava verzija). */
export const ADMIN_NAV_ITEMS: readonly ShellNavItem[] = [
  { key: 'app-releases', href: '/app-releases', labelKey: 'nav.appReleases', adminOnly: true },
] as const;