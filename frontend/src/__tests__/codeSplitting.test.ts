/**
 * FE2-4 — regresijski čuvar code-splittinga.
 */
import { describe, expect, it } from "vitest";
import appSource from "../App.tsx?raw";
import viteConfig from "../../vite.config.ts?raw";

const pageModules = import.meta.glob("../features/*/pages/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const pageNames = Object.keys(pageModules).map(
  (p) => p.split("/").pop() as string,
);

const pagePaths = Object.fromEntries(
  Object.keys(pageModules).map((p) => [p.split("/").pop() as string, p]),
);

const staticPageImports = (source: string): string[] =>
  Array.from(
    source.matchAll(
      /import\s+[^;]*?from\s+['"](\.\/(?:pages|features\/[^/]+\/pages)\/[^'"]+)['"]/g,
    ),
  ).map((m) => m[1]);

const dynamicPageImports = (source: string): string[] =>
  Array.from(
    source.matchAll(
      /import\(\s*['"](\.\/(?:pages|features\/[^/]+\/pages)\/[^'"]+)['"]\s*\)/g,
    ),
  ).map((m) => m[1]);

describe("FE2-4: App.tsx dijeli stranice po ruti", () => {
  it("ne importuje nijednu stranicu statički", () => {
    expect(staticPageImports(appSource)).toEqual([]);
  });

  it("svaku stranicu iz features/*/pages/ učitava dinamički (React.lazy)", () => {
    // `F15`: dvanaesta je `features/app-releases/pages/AppReleasesPage.tsx`
    // (admin objava verzija). Svaka nova stranica se ovdje broji svjesno.
    expect(pageNames.length, "očekuje se 12 stranica").toBe(12);
    const lazy = dynamicPageImports(appSource);
    const uncovered = pageNames
      .map((f) => pagePaths[f]!.replace(/\.tsx$/, "").replace(/^\.\.\//, "./"))
      .filter((p) => !lazy.includes(p));
    expect(uncovered).toEqual([]);
  });

  it("ima Suspense boundary oko ruta", () => {
    expect(appSource).toContain("Suspense");
    expect(appSource).toContain("fallback=");
  });

  it("Suspense fallback ne vuče antd", () => {
    const fallback = appSource.match(/function RouteFallback[\s\S]*?\n}/);
    expect(fallback, "RouteFallback mora postojati").not.toBeNull();
    expect(fallback![0]).not.toMatch(/<(Spin|Skeleton)\b/);
    expect(fallback![0]).not.toMatch(/from ['"]antd['"]/);
  });
});

describe("FE2-4: vite.config.ts grupiše vendor pakete u stabilne čipove", () => {
  it("definiše manualChunks", () => {
    expect(viteConfig).toMatch(/manualChunks\s*[:(]/);
  });

  it.each([
    ["vendor-react", "/react/"],
    ["vendor-router", "/react-router"],
    ["vendor-query", "/@tanstack/"],
    ["vendor-i18n", "/i18next/"],
    ["vendor-utils", "/axios/"],
  ])("grupa %s se stvarno vraća za %s", (chunk, pattern) => {
    expect(viteConfig).toContain(`return '${chunk}'`);
    expect(viteConfig).toContain(`'${pattern}'`);
  });

  it("ne sadrži antd/plots vendor chunk grane (I7)", () => {
    expect(viteConfig).not.toContain("vendor-antd");
    expect(viteConfig).not.toContain("vendor-plots");
    expect(viteConfig).not.toContain("@ant-design/plots");
  });
});

describe("FE2-4: antd nije u page grafu (I7)", () => {
  it("nijedna page ne importuje antd ni @ant-design/*", () => {
    const users = pageNames.filter((f) => {
      const src = pageModules[pagePaths[f]!];
      return (
        src.includes("from 'antd'") ||
        src.includes('from "antd"') ||
        src.includes("@ant-design/")
      );
    });
    expect(users).toEqual([]);
  });
});
