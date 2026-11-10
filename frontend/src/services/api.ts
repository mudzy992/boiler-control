import axios, { AxiosInstance, AxiosError } from "axios";
import type {
  CreateHomeProfileDto,
  UpdateHomeProfileDto,
  HomeProfileResponse,
} from "../types/homeProfile";
// FE2-14: tipovi generisani iz `contracts/openapi.json` (FE2-8), tako da
// potpis metode prati ugovor umjesto ručno pisane deklaracije.
import type { components } from "../types/api";

/** Red događaja grijanja (`GET /heating-events`). */
export interface HeatingEventRow {
  id: number;
  deviceId: number;
  timestampStart: string;
  timestampEnd: string | null;
  roomCurrentTemp: number | null;
  roomTargetTemp: number | null;
  hvacAction: string;
  source: string;
  isAnomaly?: boolean;
}

/** Red očitanja plina kako ga backend vraća (`GET /gas/readings`). */
export interface GasReadingRow {
  id: number;
  counterValue: number;
  readingDate: string;
  createdAt: string;
  consumption?: number | null;
  isInvoiceReference?: boolean;
  hasMeterImage?: boolean;
  hasInvoicePdf?: boolean;
  invoiceUploadedAt?: string | null;
}
import { shouldForceLoginRedirectOn401 } from "./auth401";
import type { BoilerCatalog } from "../features/home-profile/lib/boiler-catalog";
import type {
  DailyHistoryResponse,
  ShadowReportResponse,
} from "../features/reports/types";

/**
 * FE2-7 (FE-009): API base URL **bez** dev fallbacka.
 *
 * Prije ove izmjene linija je glasila:
 *   `import.meta.env.VITE_API_URL || 'http://localhost:3020/api'`
 * a `frontend/Dockerfile` ima `ARG VITE_API_URL` **bez defaulta**. Znači: build
 * pokrenut bez tog arga — npr. `docker build` ručno, ili CI korak kojem env
 * nedostaje — tiho bi ugradio `http://localhost:3020/api` u produkcijski
 * bundle. Deployovana aplikacija bi onda zvala **korisnikov vlastiti
 * localhost**, a simptom bi bio "aplikacija se učita ali ništa ne radi".
 *
 * Sada fallbacka nema. Nedostajuća vrijednost se ovdje pretvara u prazan
 * string (relativni URL-ovi, bezopasno za testove i dev), a **produkcijski
 * build pada** — vidi `requireApiBaseUrl()` u `vite.config.ts`. Odluka
 * vlasnika: "Dev fallback se uklanja (greška, ne drugi host)".
 */
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").trim();

/**
 * SEC-4 (faza 2): dual-mode autentifikacija.
 *
 * Dok backend ima `AUTH_COOKIE_REFRESH_ENABLED=off`, ponašanje je doslovno ono
 * prije ove promjene — token ide u `Authorization: Bearer`, a 401 čisti token i
 * preusmjerava na /login.
 *
 * Kad je zastavica uključena (backend to oglašava poljem `authRefreshEnabled`
 * u `GET /app/config`), klijent uz to šalje i httpOnly refresh cookie:
 *  - `withCredentials: true`, pa browser šalje cookie;
 *  - 401 pokreće JEDAN `POST /auth/refresh` i ponavlja izvorni zahtjev;
 *  - `logout()` opoziva sesiju na serveru, ne samo lokalno.
 *
 * Zastavica se namjerno čita s backend-a, a NE iz vlastitog env-a: da klijent
 * traži `credentials` koje backend nije dozvolio, browser bi **blokirao cijeli
 * odgovor**, ne samo cookie.
 */
export class ApiClient {
  private client: AxiosInstance;
  /** Da li je backend uključio httpOnly refresh tok. Zadano false. */
  private cookieAuthEnabled = false;
  /** Jedan refresh za sve konkurentne 401 (sprječava lavinu zahtjeva). */
  private refreshInFlight: Promise<boolean> | null = null;
  /** CSRF token za mutacije; dohvaća se lazily prilikom prvog potrebe. */
  private csrfToken: string | null = null;
  /** Dostupnost CSRF endpint-a (probijeno jednom, kad je neuspjelo, ne pokušava se ponovo). */
  private csrfAvailable: boolean | null = null;
  /**
   * FE2-2: access token u **memoriji**, ne u `localStorage`.
   *
   * Razlog je XSS: token u `localStorage` može pročitati bilo koji ubačeni
   * script (`localStorage.getItem('token')`), i to traje koliko i token — 24 h
   * bez revokacije (S-004). U memoriji ga JavaScript iz drugog konteksta ne
   * može dohvatiti, a nestaje reloadom stranice, nakon čega se sesija tiho
   * obnavlja iz httpOnly refresh cookie-ja.
   *
   * Ovo vrijedi SAMO kad je cookie tok uključen. Dok je zastavica `off`,
   * `localStorage` ostaje izvor istine i ponašanje je doslovno prijašnje —
   * radi, a rollback ne bi bio čist.
   */
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor to add token and CSRF header for mutations
    this.client.interceptors.request.use(async (config) => {
      // FE2-2: čita se preko `getToken()`, koji poštuje zastavicu — memorija
      // kad je cookie tok uključen, `localStorage` kad nije.
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // SEC-4: cookie se šalje samo kad backend to dozvoljava.
      config.withCredentials = this.cookieAuthEnabled;

      // SEC-7: CSRF token za mutacije (POST/PUT/PATCH/DELETE), osim auth
      // endpint-a koji CSRF nije zahtijevan (login, refresh, logout).
      const method = (config.method ?? "get").toUpperCase();
      const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
      const isAuthRoute =
        config.url?.includes("/auth/login") ||
        config.url?.includes("/auth/refresh") ||
        config.url?.includes("/auth/logout");
      if (isMutation && !isAuthRoute) {
        const csrf = await this.getCsrfToken();
        if (csrf) {
          config.headers["X-CSRF-Token"] = csrf;
        }
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const status = error.response?.status;
        const url = error.config?.url ?? "";
        const alreadyRetried = (
          error.config as { _sec4Retried?: boolean } | undefined
        )?._sec4Retried;
        const isAuthRoute =
          url.includes("/auth/refresh") || url.includes("/auth/login");

        // SEC-4: jedan pokušaj osvježavanja, pa tek onda odjava.
        if (
          status === 401 &&
          this.cookieAuthEnabled &&
          !alreadyRetried &&
          !isAuthRoute
        ) {
          const refreshed = await this.refreshSession();
          if (refreshed && error.config) {
            const retry = error.config as typeof error.config & {
              _sec4Retried?: boolean;
            };
            retry._sec4Retried = true;
            // FE2-2: novi access token je nakon rotacije u memoriji, pa se
            // retry mora čitati preko `getToken()` — `localStorage` je u
            // cookie toku namjerno prazan.
            const token = this.getToken();
            if (token) retry.headers.Authorization = `Bearer ${token}`;
            return this.client.request(retry);
          }
        }

        if (status === 401 && shouldForceLoginRedirectOn401(url)) {
          // FE2-2: `clearToken()` čisti i memoriju i localStorage, pa odjava
          // radi bez obzira na to koji je tok bio aktivan.
          // AU-01: 401 na /auth/login ne radi full reload — forma zadrži poruku.
          this.clearToken();
          window.location.href = "/login";
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * Čita `GET /app/config` i postavlja `cookieAuthEnabled`.
   * Namjerno ne baca: ako config nije dostupan, klijent ostaje na starom
   * Bearer toku umjesto da se sruši.
   */
  async detectAuthMode(): Promise<boolean> {
    try {
      const response = await this.client.get("/app/config");
      this.cookieAuthEnabled = response.data?.authRefreshEnabled === true;
    } catch {
      this.cookieAuthEnabled = false;
    }
    return this.cookieAuthEnabled;
  }

  isCookieAuthEnabled(): boolean {
    return this.cookieAuthEnabled;
  }

  /**
   * Osvježava access token preko httpOnly cookie-ja.
   * Konkurentni pozivi dijele isti promise; vraća false ako tok nije uključen
   * ili backend odbije (istekao/opozvan refresh token).
   */
  async refreshSession(): Promise<boolean> {
    if (!this.cookieAuthEnabled) return false;
    if (this.refreshInFlight) return this.refreshInFlight;

    this.refreshInFlight = (async () => {
      try {
        const response = await this.client.post("/auth/refresh");
        const token = response.data?.token;
        if (typeof token === "string" && token.length > 0) {
          this.setToken(token);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  /**
   * FE2-2: jedino mjesto koje odlučuje GDJE token živi.
   *
   * Kad je cookie tok uključen, čita se isključivo memorija — `localStorage`
   * se namjerno ne čita čak ni kao fallback, jer bi inače stari token iz
   * prethodne sesije ostao čitljiv XSS-u i nakon što je zastavica uključena.
   *
   * Kad je tok isključen, ponašanje je doslovno prijašnje (`localStorage`).
   */
  getToken(): string | null {
    if (this.cookieAuthEnabled) {
      return this.accessToken;
    }
    return localStorage.getItem("token");
  }

  /**
   * FE2-2: preuzima zaštićenu datoteku preko **iste** axios instance kao i
   * ostali pozivi.
   *
   * Zamjenjuje ručni `fetch(url, { headers: { Authorization: ... } })` u
   * `GasReadingsPage.tsx:120-124`, koji je čitao token direktno iz
   * `localStorage` i time zaobilazio cijeli auth sloj: bez `withCredentials`,
   * bez refresh-a na 401, i s tokenom koji u cookie toku više ne postoji.
   * Bez ove metode otvaranje fakture/slike brojila bi prestalo raditi čim se
   * zastavica uključi.
   */
  async downloadProtectedFile(url: string): Promise<Blob> {
    const response = await this.client.get(url, { responseType: "blob" });
    return response.data as Blob;
  }

  setToken(token: string) {
    this.accessToken = token;
    if (this.cookieAuthEnabled) {
      // FE2-2: token NE ide u localStorage. Ako tamo još stoji stari primjerak
      // iz sesije prije uključivanja zastavice, briše se — inače bi XSS i
      // dalje imao šta pročitati iako se aplikacija više ne oslanja na njega.
      localStorage.removeItem("token");
      return;
    }
    localStorage.setItem("token", token);
  }

  clearToken() {
    this.accessToken = null;
    // Čisti se bezuslovno: odjava mora ukloniti token i kad se zastavica
    // promijenila usred sesije.
    localStorage.removeItem("token");
  }

  // Auth endpoints
  async login(identifier: string, password: string) {
    const response = await this.client.post("/auth/login", {
      identifier,
      password,
    });
    return response.data;
  }

  /**
   * SEC-4: opoziva refresh sesiju na serveru, pa čisti lokalni token.
   * Greška s backend-a se namjerno guta — lokalna odjava mora uspjeti i kad
   * mreža padne, a token ionako ističe.
   */
  async logout() {
    if (this.cookieAuthEnabled) {
      try {
        await this.client.post("/auth/logout");
      } catch {
        // namjerno ignorisano
      }
    }
    this.clearToken();
  }

  /** SEC-4: javna konfiguracija (version gate + stanje auth zastavice). */
  async getAppConfig() {
    const response = await this.client.get("/app/config");
    return response.data;
  }

  /**
   * Type-safe GET poziv. Generički tip T se primenjuje na `response.data`.
   */
  async get<T = unknown>(url: string, config?: any): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * Type-safe POST poziv.
   */
  async post<T = unknown>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  /**
   * `F15`: upload datoteke preko `multipart/form-data`.
   *
   * Zašto zasebna metoda, a ne običan `post`: instanca ima default
   * `Content-Type: application/json`, a axios 1.20 na `FormData` sa JSON
   * zaglavljem radi **`JSON.stringify(formDataToJSON(data))`** — svako polje
   * postane običan string, a `File` se serijalizuje u `{}`. Server tada ne
   * dobije nijedan fajl i vrati `400 "Nedostaje APK fajl"`, iako je korisnik
   * datoteku odabrao.
   *
   * Zato se ovdje `Content-Type` postavlja na `undefined` — axios tada sam
   * postavlja `multipart/form-data; boundary=...`. Ručno napisan
   * `'multipart/form-data'` bez granice je drugi način da se isti upload slomi.
   */
  async upload<T = unknown>(url: string, form: FormData): Promise<T> {
    const response = await this.client.post<T>(url, form, {
      headers: { "Content-Type": undefined },
    });
    return response.data;
  }

  /**
   * Type-safe PUT poziv.
   */
  async put<T = unknown>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  /**
   * Type-safe PATCH poziv.
   */
  async patch<T = unknown>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  /**
   * Type-safe DELETE poziv.
   */
  async delete<T = unknown>(url: string, config?: any): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  /**
   * SEC-7: dohvaća CSRF token sa backenda. Zasticen je jednoraznim provjeravanjem
   * da li endpoint postoji; ako backend ne nudi csrf-token endpoint, brojanje se
   * prestaje i header se ne salje (soft fail, bez preloma postojećeg ponašanja).
   */
  private async getCsrfToken(): Promise<string | null> {
    if (this.csrfToken) return this.csrfToken;
    if (this.csrfAvailable === false) return null;

    try {
      const response = await this.client.get("/auth/csrf-token");
      const token = response.data?.csrfToken ?? response.data?.token;
      if (typeof token === "string" && token.length > 0) {
        this.csrfToken = token;
        this.csrfAvailable = true;
        return token;
      }
    } catch {
      // Endpoint ne postoji ili je nedostupan — CSRF se preskače.
      this.csrfAvailable = false;
    }
    return null;
  }

  // Dashboard endpoints
  async getDashboard() {
    const response = await this.client.get("/dashboard");
    return response.data;
  }

  async getDashboardHeatingEvents(params: {
    from: string;
    to: string;
    limit?: number;
  }) {
    const response = await this.client.get("/dashboard/heating-events", {
      params,
    });
    return response.data;
  }

  async getDashboardHeatingSummary(params: {
    from: string;
    to: string;
    bucket: "hour" | "day";
  }) {
    const response = await this.client.get("/dashboard/heating-summary", {
      params,
    });
    return response.data;
  }

  async getDashboardHeatingStatus() {
    const response = await this.client.get("/dashboard/heating-status");
    return response.data;
  }

  /**
   * FE2-14 (FE-010): health score i upozorenja iz JEDNOG izvora.
   *
   * Prije ovog endpointa DashboardPage je računao health score lokalno
   * (`max(0, 100 - anomalije×15)`), a mobile drugom, ponderisanom formulom, pa
   * su za isti ulaz davali različit broj. Sada oba klijenta čitaju odavde.
   *
   * Tip odgovora dolazi iz generisanog `src/types/api.d.ts`
   * (`DashboardHealthResponseDto`), ne iz ručno pisane deklaracije.
   */
  async getDashboardHealth(): Promise<
    components["schemas"]["DashboardHealthResponseDto"]
  > {
    const response = await this.client.get("/dashboard/health");
    return response.data;
  }

  // Boiler endpoints
  async getBoilerEvents() {
    const response = await this.client.get("/boiler/history");
    return response.data;
  }

  async setBoilerCurrentTemp(currentFlowTemp: number) {
    const response = await this.client.patch("/boiler/current-temp", {
      currentFlowTemp,
    });
    return response.data;
  }

  // FE2-12: getBoilerStatus() uklonjen — nijedan pozivatelj u frontendu.

  // Heating endpoints
  /**
   * Događaji grijanja, straničeno (`36`). Prije je endpoint vraćao najviše 100
   * redova bez znaka da ima još, a na grešku **prazan niz** — pa je tabela
   * tvrdila „nema zapisa" i kad ih je bilo 415 i kad je upit pao.
   */
  async getHeatingEvents(params?: {
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
    deviceId?: number;
  }): Promise<{ rows: HeatingEventRow[]; total: number }> {
    const response = await this.client.get("/heating-events", { params });
    return {
      rows: Array.isArray(response.data) ? response.data : [],
      total: Number(response.headers?.["x-total-count"] ?? 0),
    };
  }

  // FE2-12: getHeatingAnomalies() uklonjen — nijedan pozivatelj u frontendu.

  // Weather endpoints
  // FE2-12: getWeather() uklonjen — nijedan pozivatelj u frontendu;
  // getCurrentWeather(homeProfileId) je metoda koja se stvarno koristi.

  async getCurrentWeather(homeProfileId: number) {
    const response = await this.client.get(`/weather/current/${homeProfileId}`);
    return response.data;
  }

  // User endpoints
  async getUserProfile() {
    const response = await this.client.get("/user");
    return response.data;
  }

  async updateUserProfile(data: any) {
    const response = await this.client.put("/user", data);
    return response.data;
  }

  // Gas endpoints
  /**
   * Očitanja, straničeno (`33`). Server vraća niz i ukupan broj u zaglavlju
   * `X-Total-Count`; prije je vraćao **sve** redove, a lista raste svaki mjesec.
   */
  async getGasReadings(params?: {
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
  }): Promise<{ rows: GasReadingRow[]; total: number }> {
    const response = await this.client.get("/gas/readings", { params });
    return {
      rows: Array.isArray(response.data) ? response.data : [],
      total: Number(response.headers?.["x-total-count"] ?? 0),
    };
  }

  // FE2-12: addGasReadingPayload() uklonjen — nijedan pozivatelj u frontendu;
  // stvarno se koristi addGasReadingWithUpload(). Mobilna aplikacija ima
  // vlastitu istoimenu metodu u mobile/src/services/api/client.ts:141, pa ovo
  // brisanje na nju ne utječe.

  async addGasReadingWithUpload(data: {
    counterValue: number;
    readingDate: string;
    meterImage?: File;
  }) {
    const form = new FormData();
    form.append("counterValue", String(data.counterValue));
    form.append("readingDate", data.readingDate);
    if (data.meterImage) {
      form.append("meterImage", data.meterImage);
    }

    const response = await this.client.post("/gas/reading", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  }

  async deleteGasReading(id: number) {
    const response = await this.client.delete(`/gas/reading/${id}`);
    return response.data;
  }

  async updateGasReference(id: number, isReference: boolean) {
    const response = await this.client.patch(`/gas/reading/${id}/reference`, {
      isReference,
    });
    return response.data;
  }

  async uploadGasMeterImage(id: number, meterImage: File) {
    const form = new FormData();
    form.append("meterImage", meterImage);
    const response = await this.client.post(
      `/gas/reading/${id}/meter-image`,
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  }

  async uploadGasInvoice(
    id: number,
    invoicePdf: File,
    invoiceGasPriceExVat?: number,
  ) {
    const form = new FormData();
    form.append("invoicePdf", invoicePdf);
    if (invoiceGasPriceExVat !== undefined) {
      form.append("invoiceGasPriceExVat", String(invoiceGasPriceExVat));
    }
    const response = await this.client.post(
      `/gas/reading/${id}/invoice`,
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  }

  async deleteGasInvoice(id: number) {
    const response = await this.client.delete(`/gas/reading/${id}/invoice`);
    return response.data;
  }

  getGasMeterImageUrl(id: number) {
    return `${API_BASE_URL}/gas/reading/${id}/meter-image`;
  }

  getGasInvoiceUrl(id: number) {
    return `${API_BASE_URL}/gas/reading/${id}/invoice`;
  }

  async getGasAnalysis(from?: string, to?: string) {
    const params =
      from && to
        ? {
            from,
            to,
          }
        : undefined;
    const response = await this.client.get("/gas/analysis", { params });
    return response.data;
  }

  // Home Profile endpoints
  async getHomeProfile(): Promise<HomeProfileResponse> {
    const response = await this.client.get("/home-profile");
    return response.data;
  }

  async createHomeProfile(
    data: CreateHomeProfileDto,
  ): Promise<HomeProfileResponse> {
    const response = await this.client.post("/home-profile", data);
    return response.data;
  }

  async updateHomeProfile(
    id: number,
    data: UpdateHomeProfileDto,
  ): Promise<HomeProfileResponse> {
    const response = await this.client.patch(`/home-profile/${id}`, data);
    return response.data;
  }

  /**
   * Katalog bojlera (`19` §1). Nije korisnički podatak nego šifrarnik, pa se
   * ne kešira u profilu: kad se katalog dopuni, klijent odmah vidi novi zapis.
   */
  async getBoilerCatalog(): Promise<BoilerCatalog> {
    // Plural ruta: `HomeProfilesController` je onaj koji validira DTO-ove;
    // singularni `/home-profile` je stariji i nema katalog.
    const response = await this.client.get("/home-profiles/boiler-catalog");
    return response.data;
  }

  /**
   * Shadow izvještaj (`24` §6.5): koliko bi odluka kontrolera odstupila od
   * formule, u kojem smjeru i da li je svaka razlika objašnjiva.
   *
   * Ruta nosi `homeProfileId` jer izvještaj ide po kući (odluka se donosi za
   * kuću, ne za korisnika), a period je `YYYY-MM-DD`.
   */
  async getShadowReport(params: {
    homeProfileId: number;
    from: string;
    to: string;
  }): Promise<ShadowReportResponse> {
    const response = await this.client.get("/daily-record/shadow-report", {
      params,
    });
    return response.data;
  }

  /**
   * Historija dnevnih zapisa (`31`). Vraća i porijeklo svakog reda
   * (`LIVE` / `BACKFILL`) — bez toga bi rekonstruisan dan izgledao izmjeren.
   */
  async getDailyHistory(params: {
    homeProfileId: number;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<DailyHistoryResponse> {
    const response = await this.client.get("/daily-record/history", { params });
    return response.data;
  }

  // Reports endpoints
  /**
   * Preporuke, straničeno (`33`). Prije je backend tiho rezao na 100: korisnik sa
   * 299 preporuka vidio je 100 i nije imao način da sazna da ima još.
   */
  async getReports(params?: {
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
  }): Promise<{
    rows: components["schemas"]["RecommendationResponseDto"][];
    total: number;
  }> {
    const response = await this.client.get("/recommendations", { params });
    return {
      rows: Array.isArray(response.data) ? response.data : [],
      total: Number(response.headers?.["x-total-count"] ?? 0),
    };
  }

  // FE2-12: generateReport() uklonjen — nijedan pozivatelj u frontendu;
  // getReports() ostaje jer se koristi.

  // Notification endpoints
  async getNotifications() {
    const response = await this.client.get("/notifications");
    return response.data;
  }

  async markNotificationAsRead(id: number) {
    const response = await this.client.post(`/notifications/${id}/read`);
    return response.data;
  }

  async markAllNotificationsRead() {
    const response = await this.client.post("/notifications/mark-all-read");
    return response.data;
  }

  async getNotificationPreferences() {
    const response = await this.client.get("/notifications/preferences");
    return response.data;
  }

  async updateNotificationPreference(type: string, enabled: boolean) {
    const response = await this.client.patch("/notifications/preferences", {
      type,
      enabled,
    });
    return response.data;
  }
}

export const apiClient = new ApiClient();
