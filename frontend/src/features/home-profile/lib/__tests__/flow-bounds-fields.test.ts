import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import { CreateHomeProfileSchema, UpdateHomeProfileSchema } from "../schemas";

/**
 * `F13` (treći krug): donja granica polazne mora biti **upisiva iz forme**.
 *
 * Prva popravka je uvela `HomeProfile.minHeatingFlowC` i `GET
 * /api/boiler/flow-range`, pa je server znao vratiti 46 — ali nijedna forma
 * nije slala to polje. Granica je za svakog korisnika ostala zadana 48, pa je
 * unos 47 °C i dalje bio odbijen (korisnikova snimka: „Dozvoljeni raspon
 * polazne: 48 °C do 55 °C").
 *
 * Test čuva tri mjesta koja moraju biti usklađena: šema, tip i polje u formi.
 * Da je bilo koji od njih izostao, popravka bi bila nevidljiva.
 */

const PAGE = path.join(__dirname, "..", "..", "pages", "HomeProfilePage.tsx");

describe("F13: donja granica polazne je upisiva iz web forme", () => {
  it("create šema prima `minHeatingFlowC` kao broj", () => {
    const parsed = CreateHomeProfileSchema.parse({
      floorArea: 120,
      ceilingHeight: 2.7,
      insulationType: "STANDARD",
      insulationThickness: 10,
      windowType: "DOUBLE_GLAZED",
      heatingType: "RADIATOR",
      constructionYear: 1998,
      hasFloorHeating: false,
      targetMorningTemp: 21,
      targetDayTemp: 22,
      targetNightTemp: 19,
      minHeatingFlowC: 46,
    });

    expect(parsed.minHeatingFlowC).toBe(46);
  });

  /*
   * Prazno polje se šalje kao `null` (brisanje granice = vraćanje na 48), ali
   * `null` ne prolazi kroz `z.number()`. Šeme u ovom modulu nijesu validacija
   * onoga što stranica šalje — `UpdateHomeProfileDto` na backendu ima
   * `@IsOptional()`, koje propušta i `null`, pa se prazno polje šalje direktno.
   * Zato se ovdje čuva samo ono što šema stvarno tvrdi: broj u rasponu.
   */
  it("update šema prima broj u apsolutnom rasponu", () => {
    expect(
      UpdateHomeProfileSchema.parse({ minHeatingFlowC: 46 }).minHeatingFlowC,
    ).toBe(46);
  });

  it("vrijednost van apsolutnog raspona se odbija u šemi", () => {
    expect(
      UpdateHomeProfileSchema.safeParse({ minHeatingFlowC: 29 }).success,
    ).toBe(false);
    expect(
      UpdateHomeProfileSchema.safeParse({ minHeatingFlowC: 56 }).success,
    ).toBe(false);
  });

  it("forma ima polje, šalje ga i vraća ga iz profila", () => {
    const source = fs.readFileSync(PAGE, "utf8");

    // 1. polje postoji u formi i vezano je na stanje
    expect(source).toContain("minHeatingFlowC: form.minHeatingFlowC");
    // 2. učitava se iz profila (inače se pri svakom otvaranju prikaže prazno)
    expect(source).toContain(
      "minHeatingFlowC: loaded.minHeatingFlowC ?? undefined",
    );
    // 3. šalje se serveru
    expect(source).toContain("minHeatingFlowC: form.minHeatingFlowC ?? null");
    // 4. mijenja oznaku „nesačuvane izmjene"
    expect(source).toContain(
      "form.minHeatingFlowC !== (profile.minHeatingFlowC ?? undefined)",
    );
  });
});
