import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  CreateHomeProfileDto,
  UpdateHomeProfileDto,
  HomeProfileResponse,
} from '../types/homeProfile';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3020/api';

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

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // SEC-4: cookie se šalje samo kad backend to dozvoljava.
      config.withCredentials = this.cookieAuthEnabled;
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const status = error.response?.status;
        const url = error.config?.url ?? '';
        const alreadyRetried = (error.config as { _sec4Retried?: boolean } | undefined)
          ?._sec4Retried;
        const isAuthRoute =
          url.includes('/auth/refresh') || url.includes('/auth/login');

        // SEC-4: jedan pokušaj osvježavanja, pa tek onda odjava.
        if (status === 401 && this.cookieAuthEnabled && !alreadyRetried && !isAuthRoute) {
          const refreshed = await this.refreshSession();
          if (refreshed && error.config) {
            const retry = error.config as typeof error.config & {
              _sec4Retried?: boolean;
            };
            retry._sec4Retried = true;
            const token = localStorage.getItem('token');
            if (token) retry.headers.Authorization = `Bearer ${token}`;
            return this.client.request(retry);
          }
        }

        if (status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Čita `GET /app/config` i postavlja `cookieAuthEnabled`.
   * Namjerno ne baca: ako config nije dostupan, klijent ostaje na starom
   * Bearer toku umjesto da se sruši.
   */
  async detectAuthMode(): Promise<boolean> {
    try {
      const response = await this.client.get('/app/config');
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
        const response = await this.client.post('/auth/refresh');
        const token = response.data?.token;
        if (typeof token === 'string' && token.length > 0) {
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

  setToken(token: string) {
    localStorage.setItem('token', token);
  }

  clearToken() {
    localStorage.removeItem('token');
  }

  // Auth endpoints
  async login(identifier: string, password: string) {
    const response = await this.client.post('/auth/login', {
      identifier,
      password,
    });
    return response.data;
  }

  /**
   * SEC-4: opoziva refresh sesiju na serveru, pa čisti lokalni token.
   * Greška s backend-a se namjerno gutа — lokalna odjava mora uspjeti i kad
   * mreža padne, a token ionako ističe.
   */
  async logout() {
    if (this.cookieAuthEnabled) {
      try {
        await this.client.post('/auth/logout');
      } catch {
        // namjerno ignorisano
      }
    }
    this.clearToken();
  }

  /** SEC-4: javna konfiguracija (version gate + stanje auth zastavice). */
  async getAppConfig() {
    const response = await this.client.get('/app/config');
    return response.data;
  }

  // Dashboard endpoints
  async getDashboard() {
    const response = await this.client.get('/dashboard');
    return response.data;
  }

  async getDashboardHeatingEvents(params: { from: string; to: string; limit?: number }) {
    const response = await this.client.get('/dashboard/heating-events', { params });
    return response.data;
  }

  async getDashboardHeatingSummary(params: {
    from: string;
    to: string;
    bucket: 'hour' | 'day';
  }) {
    const response = await this.client.get('/dashboard/heating-summary', { params });
    return response.data;
  }

  async getDashboardHeatingStatus() {
    const response = await this.client.get('/dashboard/heating-status');
    return response.data;
  }

  // Boiler endpoints
  async getBoilerEvents() {
    const response = await this.client.get('/boiler/history');
    return response.data;
  }

  async setBoilerCurrentTemp(currentFlowTemp: number) {
    const response = await this.client.patch('/boiler/current-temp', {
      currentFlowTemp,
    });
    return response.data;
  }

  // FE2-12: getBoilerStatus() uklonjen — nijedan pozivatelj u frontendu.

  // Heating endpoints
  async getHeatingEvents() {
    const response = await this.client.get('/heating-events');
    return response.data;
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
    const response = await this.client.get('/user');
    return response.data;
  }

  async updateUserProfile(data: any) {
    const response = await this.client.put('/user', data);
    return response.data;
  }

  // Gas endpoints
  async getGasReadings() {
    const response = await this.client.get('/gas/readings');
    return response.data;
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
    form.append('counterValue', String(data.counterValue));
    form.append('readingDate', data.readingDate);
    if (data.meterImage) {
      form.append('meterImage', data.meterImage);
    }

    const response = await this.client.post('/gas/reading', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
    form.append('meterImage', meterImage);
    const response = await this.client.post(`/gas/reading/${id}/meter-image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async uploadGasInvoice(id: number, invoicePdf: File, invoiceGasPriceExVat?: number) {
    const form = new FormData();
    form.append('invoicePdf', invoicePdf);
    if (invoiceGasPriceExVat !== undefined) {
      form.append('invoiceGasPriceExVat', String(invoiceGasPriceExVat));
    }
    const response = await this.client.post(`/gas/reading/${id}/invoice`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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
    const response = await this.client.get('/gas/analysis', { params });
    return response.data;
  }

  // Home Profile endpoints
  async getHomeProfile(): Promise<HomeProfileResponse> {
    const response = await this.client.get('/home-profile');
    return response.data;
  }

  async createHomeProfile(data: CreateHomeProfileDto): Promise<HomeProfileResponse> {
    const response = await this.client.post('/home-profile', data);
    return response.data;
  }

  async updateHomeProfile(id: number, data: UpdateHomeProfileDto): Promise<HomeProfileResponse> {
    const response = await this.client.patch(`/home-profile/${id}`, data);
    return response.data;
  }

  // Reports endpoints
  async getReports() {
    const response = await this.client.get('/recommendations');
    return response.data;
  }

  // FE2-12: generateReport() uklonjen — nijedan pozivatelj u frontendu;
  // getReports() ostaje jer se koristi.

  // Notification endpoints
  async getNotifications() {
    const response = await this.client.get('/notifications');
    return response.data;
  }

  async markNotificationAsRead(id: number) {
    const response = await this.client.post(`/notifications/${id}/read`);
    return response.data;
  }

  async markAllNotificationsRead() {
    const response = await this.client.post('/notifications/mark-all-read');
    return response.data;
  }

  async getNotificationPreferences() {
    const response = await this.client.get('/notifications/preferences');
    return response.data;
  }

  async updateNotificationPreference(type: string, enabled: boolean) {
    const response = await this.client.patch('/notifications/preferences', { type, enabled });
    return response.data;
  }
}

export const apiClient = new ApiClient();
