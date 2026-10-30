import axios, { AxiosInstance, AxiosError } from 'axios';
import { SecureStorage } from '../storage/SecureStorage';
import { API_CONFIG } from '../../config/api.config';

/**
 * API Client for making HTTP requests to the backend.
 * Features:
 * - Automatic JWT token injection
 * - Automatic 401 handling (logout on invalid token)
 * - Request/response interceptors
 */
/**
 * SEC-4 (faza 3): dual-mode autentifikacija za Android.
 *
 * Dok backend ima `AUTH_COOKIE_REFRESH_ENABLED=off`, ponašanje je doslovno ono
 * prije ove promjene: token iz `SecureStorage` ide u `Authorization: Bearer`, a
 * 401 ga briše.
 *
 * Kad je zastavica uključena (backend to oglašava poljem `authRefreshEnabled`
 * u `GET /app/config`), klijent uz to drži i **rotirani refresh token** u
 * Android Keystore i koristi ga za obnovu sesije:
 *  - pri prijavi traži `refreshTransport: 'body'`, jer React Native **nema
 *    browser cookie jar** pa se httpOnly cookie ovdje ne može osloniti;
 *  - 401 pokreće JEDAN `POST /auth/refresh` i ponavlja izvorni zahtjev;
 *  - `logout()` opoziva sesiju na serveru, ne samo lokalno.
 *
 * Sve je fail-safe: ako bilo koji korak ne uspije, klijent pada na postojeći
 * Bearer tok umjesto da se sruši.
 */
class ApiClientService {
  private client: AxiosInstance;
  /** Da li je backend uključio refresh tok. Zadano false. */
  private refreshEnabled = false;
  /** Jedan refresh za sve konkurentne 401 (sprječava lavinu zahtjeva). */
  private refreshInFlight: Promise<boolean> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: API_CONFIG.TIMEOUT,
    });

    // Request interceptor: Add auth token to all requests
    this.client.interceptors.request.use(
      async (config) => {
        const token = await SecureStorage.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor: Handle 401 errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const status = error.response?.status;
        const url = error.config?.url ?? '';
        const alreadyRetried = (error.config as { _sec4Retried?: boolean } | undefined)
          ?._sec4Retried;
        const isAuthRoute =
          url.includes('/auth/refresh') || url.includes('/auth/login');

        // SEC-4: jedan pokušaj osvježavanja, pa tek onda brisanje tokena.
        if (status === 401 && this.refreshEnabled && !alreadyRetried && !isAuthRoute) {
          const refreshed = await this.refreshSession();
          if (refreshed && error.config) {
            const retry = error.config as typeof error.config & {
              _sec4Retried?: boolean;
            };
            retry._sec4Retried = true;
            const token = await SecureStorage.getToken();
            if (token) retry.headers.Authorization = `Bearer ${token}`;
            return this.client.request(retry);
          }
        }

        if (status === 401) {
          // Token is invalid, clear it
          await SecureStorage.removeToken();
          await SecureStorage.removeRefreshToken();
          // Note: Navigation to login should be handled by AuthContext
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Čita `GET /app/config` i postavlja `refreshEnabled`.
   * Namjerno ne baca: bez config-a klijent ostaje na starom Bearer toku.
   */
  async detectAuthMode(): Promise<boolean> {
    try {
      const response = await this.client.get('/app/config');
      this.refreshEnabled = response.data?.authRefreshEnabled === true;
    } catch {
      this.refreshEnabled = false;
    }
    return this.refreshEnabled;
  }

  isRefreshEnabled(): boolean {
    return this.refreshEnabled;
  }

  /**
   * Obnavlja access token koristeći refresh token iz Keystore-a.
   * Konkurentni pozivi dijele isti promise.
   */
  async refreshSession(): Promise<boolean> {
    if (!this.refreshEnabled) return false;
    if (this.refreshInFlight) return this.refreshInFlight;

    this.refreshInFlight = (async () => {
      try {
        const refreshToken = await SecureStorage.getRefreshToken();
        if (!refreshToken) return false;
        const response = await this.client.post('/auth/refresh', { refreshToken });
        const token = response.data?.token;
        if (typeof token !== 'string' || token.length === 0) return false;
        await SecureStorage.setToken(token);
        // Backend rotira refresh token — stari je sada opozvan.
        const rotated = response.data?.refreshToken;
        if (typeof rotated === 'string' && rotated.length > 0) {
          await SecureStorage.setRefreshToken(rotated);
        }
        return true;
      } catch {
        return false;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  // Auth endpoints
  async login(identifier: string, password: string) {
    const response = await this.client.post('/auth/login', {
      identifier,
      password,
      // SEC-4: RN nema browser cookie jar, pa refresh token tražimo u tijelu
      // i čuvamo ga u Android Keystore. Backend polje poštuje samo kad je
      // zastavica uključena; inače ga jednostavno ne vraća.
      refreshTransport: 'body',
    });
    const refreshToken = response.data?.refreshToken;
    if (typeof refreshToken === 'string' && refreshToken.length > 0) {
      await SecureStorage.setRefreshToken(refreshToken);
    }
    return response.data;
  }

  async register(
    email: string,
    password: string,
    name: string,
    username: string,
  ) {
    const response = await this.client.post('/auth/register', {
      email,
      password,
      name,
      username,
    });
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.client.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  }

  // Dashboard endpoints
  async getDashboard() {
    const response = await this.client.get('/dashboard');
    return response.data;
  }

  async getDashboardHeatingEvents(params: Record<string, any>) {
    const response = await this.client.get('/dashboard/heating-events', { params });
    return response.data;
  }

  async getDashboardHeatingSummary(params: Record<string, any>) {
    const response = await this.client.get('/dashboard/heating-summary', { params });
    return response.data;
  }

  async getDashboardHeatingStats(params: Record<string, any>) {
    const response = await this.client.get('/dashboard/heating-stats', { params });
    return response.data;
  }

  async getDashboardLearningTrends(params: Record<string, any>) {
    const response = await this.client.get('/dashboard/learning-trends', { params });
    return response.data;
  }

  async getDashboardExport(params: Record<string, any>) {
    const response = await this.client.get('/dashboard/export', { params });
    return response.data;
  }

  async getDashboardHeatingStatus() {
    const response = await this.client.get('/dashboard/heating-status');
    return response.data;
  }

  // Gas endpoints
  async getGasReadings() {
    const response = await this.client.get('/gas/readings');
    return response.data;
  }

  async getLatestGasReading() {
    const response = await this.client.get('/gas/latest');
    return response.data;
  }

  async addGasReading(reading: { meterReading: number; readingDate: string }) {
    const response = await this.client.post('/gas/reading', reading);
    return response.data;
  }

  async addGasReadingPayload(reading: { counterValue: number; readingDate: string }) {
    const response = await this.client.post('/gas/reading', reading);
    return response.data;
  }

  async addGasReadingWithUpload(data: {
    counterValue: number;
    readingDate: string;
    meterImage?: { uri: string; name?: string; type?: string };
  }) {
    const formData = new FormData();
    formData.append('counterValue', String(data.counterValue));
    formData.append('readingDate', data.readingDate);
    if (data.meterImage) {
      formData.append('meterImage', {
        uri: data.meterImage.uri,
        name: data.meterImage.name || 'meter-image.jpg',
        type: data.meterImage.type || 'image/jpeg',
      } as any);
    }

    const response = await this.client.post('/gas/reading', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async updateGasReference(id: number, isReference: boolean) {
    const response = await this.client.patch(`/gas/reading/${id}/reference`, {
      isReference,
    });
    return response.data;
  }

  async uploadGasMeterImage(
    id: number,
    meterImage: { uri: string; name?: string; type?: string },
  ) {
    const formData = new FormData();
    formData.append('meterImage', {
      uri: meterImage.uri,
      name: meterImage.name || 'meter-image.jpg',
      type: meterImage.type || 'image/jpeg',
    } as any);

    const response = await this.client.post(`/gas/reading/${id}/meter-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async uploadGasInvoice(
    id: number,
    invoicePdf: { uri: string; name?: string; type?: string },
    invoiceGasPriceExVat?: number,
  ) {
    const formData = new FormData();
    formData.append('invoicePdf', {
      uri: invoicePdf.uri,
      name: invoicePdf.name || 'invoice.pdf',
      type: invoicePdf.type || 'application/pdf',
    } as any);
    if (invoiceGasPriceExVat !== undefined) {
      formData.append('invoiceGasPriceExVat', String(invoiceGasPriceExVat));
    }

    const response = await this.client.post(`/gas/reading/${id}/invoice`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteGasInvoice(id: number) {
    const response = await this.client.delete(`/gas/reading/${id}/invoice`);
    return response.data;
  }

  getGasMeterImageEndpoint(id: number) {
    return `${API_CONFIG.BASE_URL}/gas/reading/${id}/meter-image`;
  }

  getGasInvoiceEndpoint(id: number) {
    return `${API_CONFIG.BASE_URL}/gas/reading/${id}/invoice`;
  }

  async deleteGasReading(id: number) {
    const response = await this.client.delete(`/gas/reading/${id}`);
    return response.data;
  }

  async getGasAnalysis() {
    const response = await this.client.get('/gas/analysis');
    return response.data;
  }

  // Boiler endpoints
  async getBoilerHistory() {
    const response = await this.client.get('/boiler/history');
    return response.data;
  }

  async setBoilerCurrentTemp(currentFlowTemp: number) {
    const response = await this.client.patch('/boiler/current-temp', {
      currentFlowTemp,
    });
    return response.data;
  }

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

  async registerPushToken(expoPushToken: string, platform: 'ios' | 'android') {
    const response = await this.client.post('/notifications/register-token', {
      expoPushToken,
      platform,
    });
    return response.data;
  }

  // Profile endpoints
  async getUserProfile() {
    const response = await this.client.get('/user');
    return response.data;
  }

  async updateUserProfile(data: {
    name?: string;
    username?: string;
    homeLocation?: string;
    password?: string;
    gasPriceExVat?: number;
    gasPriceEffectiveFrom?: string;
  }) {
    const response = await this.client.put('/user', data);
    return response.data;
  }

  async getHomeProfile() {
    const response = await this.client.get('/home-profile');
    return response.data;
  }

  async updateHomeProfile(id: number, data: any) {
    const response = await this.client.patch(`/home-profile/${id}`, data);
    return response.data;
  }

  // Recommendations
  async getRecommendations() {
    const response = await this.client.get('/recommendations');
    return response.data;
  }

  // Heating events
  async getHeatingEvents(
    paramsOrStartDate?: Record<string, any> | string,
    endDate?: string,
  ) {
    const params =
      typeof paramsOrStartDate === 'string' || endDate !== undefined
        ? { startDate: paramsOrStartDate, endDate }
        : paramsOrStartDate;

    const response = await this.client.get('/heating-events', { params });
    return response.data;
  }

  // Token management
  async setToken(token: string) {
    await SecureStorage.setToken(token);
  }

  async clearToken() {
    await SecureStorage.removeToken();
  }

  /**
   * SEC-4: opoziva refresh sesiju na serveru, pa čisti lokalnu pohranu.
   * Greška s backend-a se namjerno guta — lokalna odjava mora uspjeti i kad
   * mreža padne, a access token ionako ističe.
   */
  async logout() {
    try {
      if (this.refreshEnabled) {
        const refreshToken = await SecureStorage.getRefreshToken();
        if (refreshToken) {
          await this.client.post('/auth/logout', { refreshToken });
        }
      }
    } catch {
      // namjerno ignorisano
    }
    await SecureStorage.removeToken();
    await SecureStorage.removeRefreshToken();
  }
}

export const apiClient = new ApiClientService();
