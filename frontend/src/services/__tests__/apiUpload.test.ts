import type { AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `F15` — regresija koja je korisniku vratila `400 "Nedostaje APK fajl"` iako je
 * datoteku odabrao.
 *
 * Uzrok (dokazan u `axios@1.20.0`, `dist/node/axios.cjs`):
 *
 *     transformRequest(data, headers) {
 *       const hasJSONContentType = contentType.indexOf('application/json') > -1;
 *       const isFormData = utils.isFormData(data);
 *       if (isFormData) {
 *         return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
 *       }
 *       ...
 *
 * Dijeljena instanca ima `Content-Type: application/json`, pa `FormData` postaje
 * JSON: polja ostaju stringovi, a `File` se serijalizuje u `{}`. Server tada u
 * `req.file` nema ništa i vraća 400 — tačno ono što je korisnik vidio.
 *
 * Test zato **ne** provjerava izvor grepom, nego stvarno ponašanje: propušta
 * `FormData` kroz `transformRequest` i traži da izađe kao `FormData`, a ne kao
 * string. Grep bi prošao i kad bi se greška vratila kroz drugu putanju.
 */

type ClientWithAxios = { client: AxiosInstance };

async function loadFreshApi(): Promise<{
  client: AxiosInstance;
  api: unknown;
}> {
  vi.resetModules();
  const mod = await import("../api");
  return {
    client: (mod.apiClient as unknown as ClientWithAxios).client,
    api: mod.apiClient,
  };
}

/** Kopija ponašanja axios-ovog `transformRequest` za `FormData` (v. komentar gore). */
function transformLikeAxios(client: AxiosInstance, form: FormData): unknown {
  const headers = client.defaults.headers as Record<string, unknown>;
  const postHeaders = headers.post as Record<string, unknown> | undefined;
  const contentType = String(
    headers["Content-Type"] ?? postHeaders?.["Content-Type"] ?? "",
  );
  const transform = client.defaults.transformRequest as unknown;
  const list = Array.isArray(transform) ? transform : [transform];
  let data: unknown = form;
  for (const fn of list) {
    if (typeof fn !== "function") continue;
    data = fn.call(client.defaults, data, {
      getContentType: () => contentType,
      setContentType: () => undefined,
      hasContentType: () => contentType !== "",
    });
  }
  return data;
}

describe("F15: upload APK-a mora ostati multipart", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("dijeljena instanca ima JSON Content-Type (uzrok regresije)", async () => {
    const { client } = await loadFreshApi();
    const headers = client.defaults.headers as Record<string, unknown>;
    expect(String(headers["Content-Type"])).toContain("application/json");

    // I upravo zato bi običan `post` slomio FormData:
    const form = new FormData();
    form.append("notes", "test");
    form.append(
      "apk",
      new Blob(["x"], { type: "application/vnd.android.package-archive" }),
      "a.apk",
    );
    const transformed = transformLikeAxios(client, form);
    expect(typeof transformed).toBe("string");
    expect(transformed).not.toBeInstanceOf(FormData);
  });

  it("`upload` gasi JSON Content-Type, pa se FormData ne pretvara u JSON", async () => {
    const { client, api } = await loadFreshApi();
    const form = new FormData();
    form.append("apk", new Blob(["x"]), "a.apk");

    const spy = vi
      .spyOn(client, "post")
      .mockResolvedValue({ data: { version: "1.4.0" } } as never);

    await (
      api as { upload: (url: string, form: FormData) => Promise<unknown> }
    ).upload("/app-releases", form);

    const [, body, config] = spy.mock.calls[0];
    expect(body).toBe(form);
    // Ovo je srž: `undefined` pušta axios-u da sam postavi granicu. Ručno
    // napisan `'multipart/form-data'` bez boundary-ja lomi isti upload.
    expect(
      (config as { headers: Record<string, unknown> }).headers["Content-Type"],
    ).toBeUndefined();
  });
});
