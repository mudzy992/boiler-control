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
class ApiClientService {
  private client: AxiosInstance;

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
        if (error.response?.status === 401) {
          // Token is invalid, clear it
          await SecureStorage.removeToken();
          // Note: Navigation to login should be handled by AuthContext
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(identifier: string, password: string) {
    const response = await this.client.post('/auth/login', {
      identifier,
      password,
    });
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
}

export const apiClient = new ApiClientService();
