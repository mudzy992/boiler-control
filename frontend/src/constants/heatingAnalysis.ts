/**
 * FE2-14 (FE-010): pragovi analize grijanja na dashboardu.
 *
 * Ovi brojevi su ranije bili **magijske vrijednosti** rasute po
 * `DashboardPage.tsx` (20, 3, 1.5, 90, 15) i nigdje dokumentovani kao politika.
 * Nalaz FE-010 to izričito traži: „dok se ne preseli, dokumentovati magijske
 * brojeve kao privremenu politiku".
 *
 * ⚠️ PRIVREMENA POLITIKA, NIJE STRUČNO POTVRĐENA.
 * Vrijednosti su preuzete iz postojećeg koda 1:1 — ovo ih NE mijenja, samo ih
 * imenuje i čini vidljivima na jednom mjestu. Za stvarno utvrđivanje pragova
 * potrebna je odluka vlasnika i/ili inženjera grijanja.
 *
 * ⚠️ POREKLO OVIH BROJEVA NIJE BACKEND. Health score i pravila upozorenja se
 * računaju na klijentu; backend nema odgovarajući endpoint (Dashboard kontroler
 * izlaže samo: `/`, `heating-events`, `heating-status`, `heating-summary`,
 * `heating-stats`, `learning-trends`, `export`). Mobilni klijent računa health
 * score **potpuno drugom formulom** (ponderisano: learning 35 + flowDelta 25 +
 * thermostat freshness 25 + anomalije 15, `DashboardScreen.tsx:165-215`), pa
 * web i mobile NE daju isti broj za isti ulaz. Preseljenje u jedan izvor je
 * otvorena stavka FE2-14 koja traži odluku vlasnika.
 */

/** Ciklus kraći od ovoga smatra se „kratkim" (min). */
export const SHORT_CYCLE_MINUTES = 20;

/** Koliko kratkih ciklusa mora postojati da se prikaže upozorenje. */
export const SHORT_CYCLE_COUNT_THRESHOLD = 3;

/** Ciklus duži od ovoga smatra se „dugim" (min). */
export const LONG_CYCLE_MINUTES = 90;

/**
 * Prosječno zaostajanje za ciljnom temperaturom (°C) iznad kojeg se upozorava.
 *
 * FE2-14: izraz `targetTemp - currentTemp` je pozitivan kad prostorija ZAOSTAJE
 * za ciljem. Ranije je ova grana bila označena kao „overshoot", što je značilo
 * suprotno od izmjerenog — vidi komentar na mjestu upotrebe u DashboardPage.
 */
export const TARGET_SHORTFALL_WARN_C = 1.5;

/** Koliko bodova health score gubi po anomaliji. */
export const HEALTH_SCORE_PENALTY_PER_ANOMALY = 15;

/** Početni (maksimalni) health score. */
export const HEALTH_SCORE_BASE = 100;

/**
 * Health score kakav web prikazuje: `max(0, 100 - anomalije × 15)`.
 *
 * Izdvojeno kao funkcija da postoji JEDNO mjesto gdje se računa, i da se može
 * testirati bez renderovanja cijelog dashboarda.
 *
 * ⚠️ Ovo NIJE ista formula koju koristi mobile — vidi napomenu na vrhu fajla.
 */
export function computeHealthScore(anomalyCount: number): number {
  return Math.max(
    0,
    HEALTH_SCORE_BASE - anomalyCount * HEALTH_SCORE_PENALTY_PER_ANOMALY
  );
}
