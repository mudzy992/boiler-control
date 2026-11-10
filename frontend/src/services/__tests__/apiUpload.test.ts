import { describe, expect, it, vi, afterEach } from "vitest";

/**
 * `F15` — regresija koja se **stvarno dogodila na produkciji dvaput**:
 * `400 "Nedostaje APK fajl"`, iako je fajl odabran (45.6 MB) i prikazan pod
 * „Odabrano: …". Kroz ovaj fajl su prošla tri pogrešna rješenja, sva tri
 * izmjerena, pa su ovdje zapisana da se ne ponove:
 *
 * 1. `this.client.post(url, form)` — dijeljena instanca ima
 *    `Content-Type: application/json`; axios tada radi
 *    `JSON.stringify(formDataToJSON(data))`, fajl postane `{}` nijedan ne stigne.
 * 2. `{ headers: { 'Content-Type': undefined } }` — `dispatchRequest` poslije
 *    transformacije ipak postavi `application/x-www-form-urlencoded` za POST;
 *    multer traži `multipart/form-data` i vrati 400.
 * 3. Ručni `'multipart/form-data; boundary=X'` — browser tada ne prepisuje
 *    zaglavlje, ali **tijelo serijalizuje svojom granicom**, pa se delimiteri
 *    ne poklapaju (izmjereno `match:false`) i multer opet ne nađe fajl.
 *
 * Ispravno rješenje (i ono što ovaj test čuva): syrov `XMLHttpRequest` **bez
 * ijednog `Content-Type`** — browser tada sam postavi granicu koja stvarno
 * stoji u tijelu (izmjereno `delimiterMatches:true`).
 */

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Minimalni XHR stub koji bilježi šta je aplikacija tražila od browsera. */
function installXhrStub(
  response: { status: number; text: string } = {
    status: 201,
    text: '{"version":"1.4.0"}',
  },
) {
  const requests: Recorded[] = [];

  class StubXHR {
    static current: StubXHR | null = null;
    upload = { addEventListener: () => undefined };
    withCredentials = false;
    status = 0;
    responseText = "";
    response = "";
    responseType = "";
    timeout = 0;
    readyState = 0;
    onloadend: (() => void) | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;
    private record: Recorded = {
      url: "",
      method: "",
      headers: {},
      body: undefined,
    };

    constructor() {
      StubXHR.current = this;
    }

    open(method: string, url: string) {
      this.record.method = method;
      this.record.url = url;
    }

    setRequestHeader(key: string, value: string) {
      this.record.headers[key] = value;
    }

    abort() {
      /* noop */
    }

    getAllResponseHeaders() {
      return "content-type: application/json\r\n";
    }

    getResponseHeader() {
      return "application/json";
    }

    send(body: unknown) {
      this.record.body = body;
      requests.push(this.record);
      this.status = response.status;
      this.responseText = response.text;
      this.response = response.text;
      this.readyState = 4;
      this.onload?.();
      this.onloadend?.();
    }
  }

  vi.stubGlobal("XMLHttpRequest", StubXHR as never);
  return { requests, StubXHR };
}

async function freshApi() {
  vi.resetModules();
  const mod = await import("../api");
  return mod.apiClient;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("F15: upload APK-a — Content-Type mora ostaviti browseru", () => {
  it("ne šalje NIJEDAN Content-Type (browser dodaje granicu koja odgovara tijelu)", async () => {
    const { requests } = installXhrStub();
    const api = await freshApi();

    const form = new FormData();
    form.append("apk", new Blob(["x".repeat(32)]), "build.apk");
    form.append("version", "1.4.0");

    await api.upload("/app-releases", form);

    // Prvi zahtjev je CSRF provjera (endpoint ne postoji), drugi je upload.
    const upload = requests.filter((r) => r.method === "POST");
    expect(upload).toHaveLength(1);
    const keys = Object.keys(upload[0].headers).map((k) => k.toLowerCase());
    expect(keys).not.toContain("content-type");
    // Tijelo ide kao FormData, nikad kao string (JSON) — to je bila prva greška.
    expect(upload[0].body).toBe(form);
  });

  it("ručna granica u zaglavlju NE smije se vraćati (tijelo bi imalo drugu)", async () => {
    const { requests } = installXhrStub();
    const api = await freshApi();
    await api.upload("/app-releases", new FormData());

    const upload = requests.filter((r) => r.method === "POST");
    const contentType = upload[0].headers["Content-Type"];
    expect(contentType).toBeUndefined();
  });

  it("šalje Authorization i CSRF ručno — metoda ne zaobilazi prijavu", async () => {
    const { requests } = installXhrStub();
    const api = await freshApi();
    api.setToken("test-token");

    // CSRF endpoint ne postoji; `getCsrfToken` tada ne smije blokirati upload.
    vi.spyOn(
      api as unknown as { getCsrfToken: () => Promise<string | null> },
      "getCsrfToken",
    ).mockResolvedValue("csrf-123");

    await api.upload("/app-releases", new FormData());

    const upload = requests.filter((r) => r.method === "POST");
    expect(upload[0].headers.Authorization).toBe("Bearer test-token");
    expect(upload[0].headers["X-CSRF-Token"]).toBe("csrf-123");
  });

  it("grešku servera pretvara u isti oblik kao axios (ekrani čitaju `message`)", async () => {
    installXhrStub({
      status: 400,
      text: JSON.stringify({ message: "Nedostaje APK fajl", statusCode: 400 }),
    });
    const api = await freshApi();

    await expect(
      api.upload("/app-releases", new FormData()),
    ).rejects.toMatchObject({
      message: "Nedostaje APK fajl",
      status: 400,
    });
  });

  it('bez JSON poruke daje čitljiv status, a ne „[object Object]"', async () => {
    installXhrStub({ status: 502, text: "<html>Bad gateway</html>" });
    const api = await freshApi();

    await expect(api.upload("/app-releases", new FormData())).rejects.toThrow(
      "Request failed with status code 502",
    );
  });
});
