import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  CreateHomeProfileDto,
  UpdateHomeProfileDto,
  HomeProfileResponse,
} from '../types/homeProfile';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3020/api';

export class ApiClient {
  private client: AxiosInstance;

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
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
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

  async logout() {
    this.clearToken();
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

  async getBoilerStatus() {
    const response = await this.client.get('/boiler/status');
    return response.data;
  }

  // Heating endpoints
  async getHeatingEvents() {
    const response = await this.client.get('/heating-events');
    return response.data;
  }

  async getHeatingAnomalies() {
    const response = await this.client.get('/anomalies');
    return response.data;
  }

  // Weather endpoints
  async getWeather() {
    const response = await this.client.get('/weather');
    return response.data;
  }

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

  async addGasReadingPayload(data: { counterValue: number; readingDate: string }) {
    const response = await this.client.post('/gas/reading', data);
    return response.data;
  }

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

  async generateReport() {
    const response = await this.client.post('/recommendations/generate', {});
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
}

export const apiClient = new ApiClient();
