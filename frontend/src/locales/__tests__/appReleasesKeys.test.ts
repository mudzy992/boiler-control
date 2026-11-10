import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../config";

/**
 * `F15` — regresija koja se stvarno dogodila na ekranu „Verzije mobilne
 * aplikacije": ispod inputa je pisalo **`appReleases.fileSelected`**, a dugme
 * „Objavi verziju" umjesto „Pošalji APK".
 *
 * Uzrok nije bio `t()` poziv, nego **nedostajući ključ**: stranica je tražila
 * `fileSelected`/`fileNotSelected`, a prevodi su dodavani u drugoj izmjeni
 * (prettier je u međuvremenu preveo fajl na dvostruke navodnike, pa je izmjena
 * tiho promašila). i18next tada vraća sam ključ — na ekranu se ispiše
 * `appReleases.fileSelected`, što izgleda kao greška u kodu, a to je praznina
 * u prijevodima.
 *
 * Ovaj test čita **stvarni ekran** i traži da svaki `t("…")` literal u njemu
 * postoji u oba jezika. Time ista greška ne može proći ni u sljedećem ekranu.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const pagePath = path.resolve(
  here,
  "../../features/app-releases/pages/AppReleasesPage.tsx",
);
const bannerPath = path.resolve(here, "../../ui/banner.tsx");

function usedKeys(file: string): string[] {
  const source = readFileSync(file, "utf8");
  // Samo `t("…")` / `t('…')`, ne `i18n.t` u komentarima i ne dinamički ključevi.
  const matches = source.matchAll(/\bt\(\s*["'`]([\w.]+)["'`]/g);
  return [...new Set([...matches].map((match) => match[1]))];
}

const flatKeys = (bundle: Record<string, unknown>, prefix = ""): string[] =>
  Object.entries(bundle).flatMap(([key, value]) =>
    value !== null && typeof value === "object"
      ? flatKeys(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

describe('F15: ključevi ekrana „Verzije mobilne aplikacije"', () => {
  it("ekran koristi najmanje deset ključeva (test ne smije proći na praznom spisku)", () => {
    // Kontrola: pogrešan regex bi dao prazan spisak i test bi uvijek prolazio.
    const keys = usedKeys(pagePath);
    expect(keys.length).toBeGreaterThanOrEqual(10);
    expect(keys).toContain("appReleases.fileSelected");
    expect(keys).toContain("appReleases.upload");
  });

  it.each(["en-US", "bs-BS"])("svaki ključ postoji u %s", (language) => {
    const bundle = i18n.getResourceBundle(language, "translation");
    expect(bundle).toBeTruthy();

    const available = new Set(flatKeys(bundle));
    const missing = usedKeys(pagePath).filter((key) => !available.has(key));

    expect(missing).toEqual([]);
  });

  it("tekstovi za izbor datoteke postoje u oba jezika (ne vraća se ključ)", async () => {
    for (const language of ["en-US", "bs-BS"]) {
      await i18n.changeLanguage(language);
      expect(i18n.t("appReleases.fileNotSelected")).not.toBe(
        "appReleases.fileNotSelected",
      );
      // Interpolacija mora dati tekst, ne `{{name}}` ostatak.
      const selected = i18n.t("appReleases.fileSelected", {
        name: "app.apk",
        size: "12.0 MB",
      });
      expect(selected).toContain("app.apk");
      expect(selected).not.toContain("{{");
    }
    await i18n.changeLanguage("en-US");
  });

  it("dugme ne zvuči kao da je objava već obavljena", async () => {
    await i18n.changeLanguage("bs-BS");
    expect(i18n.t("appReleases.upload")).toBe("Pošalji APK");
    await i18n.changeLanguage("en-US");
    expect(i18n.t("appReleases.upload")).toBe("Upload APK");
  });

  it("banner (koristi ga ekran kroz Card/Button) nema ključeva bez prijevoda", () => {
    const bundle: Record<string, unknown> = {};
    for (const language of ["en-US", "bs-BS"]) {
      bundle[language] = i18n.getResourceBundle(language, "translation");
    }
    // `banner.tsx` danas ne koristi `t()`; test ostaje kao čuvar ako počne.
    const keys = usedKeys(bannerPath);
    for (const key of keys) {
      for (const language of ["en-US", "bs-BS"]) {
        const available = new Set(
          flatKeys(bundle[language] as Record<string, unknown>),
        );
        expect(available.has(key)).toBe(true);
      }
    }
  });
});
