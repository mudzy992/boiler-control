import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A11Y (2026-11-21): kontrast web palete je **mjeren**, ne pretpostavljen.
 *
 * Do sada je web imao `axe` sken (`accessibility.test.tsx`), ali on je
 * `color-contrast` pravilo isključivao jer jsdom nema layout — pa je jedini
 * mjerni alat bio mobilni `a11yContrast.test.ts`. Posljedica: **ista paleta se
 * u dvije aplikacije razlikovala**, a web je u svijetloj temi padao AA:
 *
 *   `--signal` 255 107 61 → 2,55:1   `--ok` 34 197 94 → 2,05:1
 *   `--warn`   245 165 36 → 1,84:1   `--info` 56 189 248 → 1,93:1
 *   `--fault`  239 68 68  → 3,39:1   `--ink-dim` 107 114 128 → 4,35:1
 *
 * Ove boje se koriste kao tekst (`text-fault`, `text-ok`, `text-signal`,
 * `bg-fault/10 text-fault`) i kao ikone, pa je granica **AA 4,5:1** — i to na
 * sve tri podloge (`panel`, `canvas`, `raised`), ne samo na bijeloj.
 *
 * Test čita `tokens.css` (izvor istine) umjesto da duplira brojeve: ako se
 * paleta promijeni, mjeri se nova, a ne kopija u testu.
 */

const CSS = readFileSync(resolve(__dirname, "../tokens.css"), "utf8");

type Rgb = [number, number, number];

function parseBlock(source: string): Record<string, Rgb> {
  const tokens: Record<string, Rgb> = {};
  const pattern = /--([a-z0-9-]+):\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3});/g;
  for (const match of source.matchAll(pattern)) {
    tokens[match[1]] = [
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
    ];
  }
  return tokens;
}

/** Blok `:root` (svijetla) i `html.dark` (tamna) — redom kako stoje u fajlu. */
const lightCss = CSS.slice(0, CSS.indexOf("html.dark"));
const darkCss = CSS.slice(CSS.indexOf("html.dark"));

const light = parseBlock(lightCss);
const dark = parseBlock(darkCss);

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.2 kontrastni odnos, zaokružen na dvije decimale. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** Prozirna podloga: boja tonusa na 10% preko površine (`bg-ok/10`). */
function tint(over: Rgb, under: Rgb, alpha: number): Rgb {
  return [
    Math.round(over[0] * alpha + under[0] * (1 - alpha)),
    Math.round(over[1] * alpha + under[1] * (1 - alpha)),
    Math.round(over[2] * alpha + under[2] * (1 - alpha)),
  ];
}

const SURFACES = ["panel", "canvas", "raised"] as const;

/** Tokeni koje Tailwind koristi kao boju teksta ili ikone. */
const TEXT_TOKENS = [
  "ink",
  "ink-muted",
  "ink-dim",
  "signal",
  "ok",
  "warn",
  "fault",
  "info",
] as const;

const TONES = ["signal", "ok", "warn", "fault", "info"] as const;

describe.each([
  ["svijetla", light],
  ["tamna", dark],
] as const)("web paleta — %s tema", (_name, tokens) => {
  it("svaki tekstualni token prolazi AA (4,5:1) na sve tri podloge", () => {
    const failures: string[] = [];
    for (const token of TEXT_TOKENS) {
      for (const surface of SURFACES) {
        const ratio = contrastRatio(tokens[token], tokens[surface]);
        if (ratio < 4.5) {
          failures.push(`${token}/${surface} = ${ratio}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("tekst na vlastitoj 10% podlozi prolazi AA (`bg-fault/10 text-fault`)", () => {
    const failures: string[] = [];
    for (const tone of TONES) {
      for (const surface of SURFACES) {
        const ratio = contrastRatio(
          tokens[tone],
          tint(tokens[tone], tokens[surface], 0.1)
        );
        if (ratio < 4.5) failures.push(`${tone}/tint-${surface} = ${ratio}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("primarni tekst prolazi AAA (7:1)", () => {
    for (const surface of SURFACES) {
      expect(contrastRatio(tokens.ink, tokens[surface])).toBeGreaterThanOrEqual(7);
    }
  });

  it("tekst na dugmetu prolazi AA u svim varijantama", () => {
    const pairs: Array<[string, string]> = [
      ["btn-primary-fg", "btn-primary-bg"],
      ["btn-primary-fg", "btn-primary-bg-hover"],
      ["btn-secondary-fg", "btn-secondary-bg"],
      ["btn-secondary-fg", "btn-secondary-bg-hover"],
      ["btn-danger-fg", "btn-danger-bg"],
      ["btn-danger-fg", "btn-danger-bg-hover"],
      ["input-fg", "input-bg"],
    ];
    const failures = pairs
      .map(([fg, bg]) => ({ fg, bg, ratio: contrastRatio(tokens[fg], tokens[bg]) }))
      .filter((row) => row.ratio < 4.5)
      .map((row) => `${row.fg}/${row.bg} = ${row.ratio}:1`);
    expect(failures).toEqual([]);
  });

  it("placeholder u polju prolazi AA (4,5:1)", () => {
    expect(
      contrastRatio(tokens["input-placeholder"], tokens["input-bg"])
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe("web i mobilna paleta se ne razilaze", () => {
  /**
   * Isti sistem u dvije aplikacije ne smije imati dvije granice: ako web
   * dozvoli 4,4:1 a mobilni 4,5:1, ista boja je „pristupačna" na jednom mjestu
   * i nije na drugom. Test poredi **vrijednosti tonusa**, ne izgled ekrana.
   */
  const mobileTokens = readFileSync(
    resolve(
      __dirname,
      "../../../../mobile/src/theme/tokens.ts"
    ),
    "utf8"
  );

  function mobileHex(name: "lightTokens" | "darkTokens", token: string): Rgb {
    const block = mobileTokens.slice(mobileTokens.indexOf(`${name}: ThemeTokens`));
    const match = new RegExp(`${token}: '(#[0-9a-f]{6})'`).exec(block);
    if (!match) throw new Error(`nema ${token} u ${name}`);
    const hex = match[1].slice(1);
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  it.each([
    ["lightTokens", light],
    ["darkTokens", dark],
  ] as const)("%s — tonusi su isti kao u web tokenima", (name, webTokens) => {
    for (const tone of TONES) {
      expect({ tone, value: webTokens[tone] }).toEqual({
        tone,
        value: mobileHex(name, tone),
      });
    }
  });
});
