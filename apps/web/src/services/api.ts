import axios, { AxiosInstance, AxiosError } from 'axios';

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
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
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
    const response = await this.client.post('/gas/readings', data);
    return response.data;
  }

  async deleteGasReading(id: number) {
    const response = await this.client.delete(`/gas/readings/${id}`);
    return response.data;
  }

  // Home Profile endpoints
  async getHomeProfile() {
    const response = await this.client.get('/home-profile');
    return response.data;
  }

  async createHomeProfile(data: any) {
    const response = await this.client.post('/home-profile', data);
    return response.data;
  }

  async updateHomeProfile(id: number, data: any) {
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
