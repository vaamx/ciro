import axios from 'axios';
import type { User, LoginCredentials, RegisterCredentials } from '../types/auth';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, remove from storage
      localStorage.removeItem('accessToken');
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authAPI = {
  async login(credentials: LoginCredentials): Promise<{ user: User; accessToken: string; token: string }> {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  async signup(credentials: RegisterCredentials): Promise<{ message: string; user: User }> {
    const response = await api.post('/auth/register', credentials);
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async getMe(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Energy data API endpoints
export const energyAPI = {
  async getUsageData(period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const response = await api.get(`/energy/usage?period=${period}`);
    return response.data;
  },

  async getSavingsData() {
    const response = await api.get('/energy/savings');
    return response.data;
  },

  async getEfficiencyData() {
    const response = await api.get('/energy/efficiency');
    return response.data;
  },

  async getAlerts() {
    const response = await api.get('/energy/alerts');
    return response.data;
  },
};

// Billing API endpoints
export const billingAPI = {
  async getBills(limit: number = 12) {
    const response = await api.get(`/billing/bills?limit=${limit}`);
    return response.data;
  },

  async getBill(billId: string) {
    const response = await api.get(`/billing/bills/${billId}`);
    return response.data;
  },

  async downloadBill(billId: string) {
    const response = await api.get(`/billing/bills/${billId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async getPaymentMethods() {
    const response = await api.get('/billing/payment-methods');
    return response.data;
  },
};

// Profile API endpoints
export const profileAPI = {
  async getProfile(): Promise<User> {
    const response = await api.get('/profile');
    return response.data;
  },

  async updateProfile(profileData: Partial<User>) {
    const response = await api.put('/profile', profileData);
    return response.data;
  },

  async changePassword(passwordData: { currentPassword: string; newPassword: string }) {
    const response = await api.put('/profile/password', passwordData);
    return response.data;
  },
};

// Notifications API endpoints
export const notificationsAPI = {
  async getNotifications() {
    const response = await api.get('/notifications');
    return response.data;
  },

  async markAsRead(notificationId: string) {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  },

  async getPreferences() {
    const response = await api.get('/notifications/preferences');
    return response.data;
  },

  async updatePreferences(preferences: any) {
    const response = await api.put('/notifications/preferences', preferences);
    return response.data;
  },
};

// Export the main API instance for custom requests
export default api; 