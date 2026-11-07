# Redesign state

Ažurirano: 2026-11-07.

## Trenutna faza

**Faza 5 — I6 u toku.** Auth…Profile shells gotovi; Dashboard još TempDialog only.

**Sljedeće:** Dashboard full (SVG/QueryState) → I7 antd out.

## Završeno (I6)

- Auth, Boiler
- Heating + Reports (PageHeader/QueryState/Table)
- Gas readings: ConfirmDialog umjesto `window.confirm`
- Gas analytics: PageHeader/QueryState + period-bar/metrics helpers
- Notifications: lucide + QueryState (bez antd icons)
- Profile: shells + VAT via `gasPriceVatRate ?? DEFAULT_GAS_PRICE_VAT_RATE` (0.17)
- Home profile: PageHeader/QueryState/StatusBanner (minimal)
- Dashboard: TempDialog only
- i18n: 297 keys EN=BS (profile.* + notifications count keys)

## Još nije (I6)

- Dashboard full redesign (SVG/antd out of page shell)
