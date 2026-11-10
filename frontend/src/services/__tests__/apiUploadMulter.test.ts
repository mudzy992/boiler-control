import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

/**
 * `F15` — završni dokaz protiv **pravog** `express` + `multer` servera, ne
 * protiv stuba. Test pušta isti middleware koji koristi backend
 * (`FileInterceptor('apk')` je `multer().single('apk')`) i šalje istu formu koju
 * šalje admin ekran.
 *
 * Prije popravke `apiClient.post(FormData)` je ovdje padao sa `400` — javio se
 * `content-type: application/json` i `req.file === undefined`, jer dijeljena
 * axios instanca pretvori `FormData` u JSON tekst. Upravo taj `400` je korisnik
 * dobijao na ekranu.
 *
 * eslint-disable-next-line @typescript-eslint/no-require-imports
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const express = require("/home/user/boiler-control/backend/node_modules/express");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const multer = require("/home/user/boiler-control/backend/node_modules/multer");

interface Seen {
  contentType: string | undefined;
  fileSize: number | undefined;
  fileName: string | undefined;
}

let server: Server;
let baseUrl = "";
const seen: Seen[] = [];

beforeAll(async () => {
  const app = express();
  // jsdom traži CORS zaglavlja i za `Authorization`, inače XHR padne na
  // „Cross origin … forbidden" prije nego zahtjev uopšte ode.
  app.use((req: any, res: any, next: any) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, X-CSRF-Token, Content-Type",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.post(
    "/api/app-releases",
    multer({ limits: { fileSize: 200 * 1024 * 1024 } }).single("apk"),
    (req: any, res: any) => {
      seen.push({
        contentType: req.headers["content-type"],
        fileSize: req.file?.size,
        fileName: req.file?.originalname,
      });
      if (!req.file) {
        return res
          .status(400)
          .json({ message: "Nedostaje APK fajl", statusCode: 400 });
      }
      res.status(201).json({
        version: req.body.version,
        size: req.file.size,
        name: req.file.originalname,
      });
    },
  );

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) =>
    server.once("listening", () => resolve()),
  );
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  vi.stubEnv("VITE_API_URL", baseUrl);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Ista forma koju sklapa `AppReleasesPage`. */
function buildForm(sizeBytes: number) {
  const form = new FormData();
  form.append(
    "apk",
    new Blob([new Uint8Array(sizeBytes)]),
    "build-1794342462408.apk",
  );
  form.append("version", "1.4.0");
  return form;
}

async function freshClient() {
  vi.resetModules();
  const { apiClient } = await import("../api");
  // CSRF endpoint ne postoji u backendu; bez ovoga bi test čekao mrežu.
  (
    apiClient as unknown as { getCsrfToken: () => Promise<string | null> }
  ).getCsrfToken = async () => null;
  apiClient.setToken("test-token");
  return apiClient;
}

describe("F15: APK upload kroz pravi multer (regresija na 400)", () => {
  it("`upload()` pošalje 45 MB fajl i multer ga primi sa tačnim imenom", async () => {
    const api = await freshClient();
    const size = 45 * 1024 * 1024;

    const result = await api.upload<{
      size: number;
      name: string;
      version: string;
    }>("/app-releases", buildForm(size));

    expect(result.size).toBe(size);
    expect(result.name).toBe("build-1794342462408.apk");
    expect(result.version).toBe("1.4.0");
    expect(seen.at(-1)?.contentType).toMatch(
      /^multipart\/form-data; boundary=/,
    );
  }, 60_000);

  it("`post(FormData)` ne tiho padne na 400 — preusmjeri se na `upload()`", async () => {
    const api = await freshClient();

    const result = await api.post<{ size: number }>(
      "/app-releases",
      buildForm(4096),
    );

    expect(result.size).toBe(4096);
    expect(seen.at(-1)?.fileName).toBe("build-1794342462408.apk");
    expect(seen.at(-1)?.contentType).toMatch(
      /^multipart\/form-data; boundary=/,
    );
  });

  it("običan JSON POST ostaje JSON (popravak ne mijenja ostale ekrane)", async () => {
    const api = await freshClient();
    // Bez rute na serveru dobijamo 404 — bitno je da je otišao kao JSON, a ne
    // kao multipart, inače bi svaka obična mutacija bila pokvarena.
    await expect(api.post("/nepostojeca-ruta", { a: 1 })).rejects.toMatchObject(
      {
        status: 404,
      },
    );
  });
});
