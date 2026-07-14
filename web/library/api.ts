import axios, { type AxiosInstance } from 'axios';
import { authStorage, type User, type UserRole } from './AuthStorage';

// ============ TYPE DEFINITIONS ============
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface LoginResponse {
  user: User;
  token: string;
  role: UserRole;
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  links: PaginationLink[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

export interface PaginationLink {
  url: string | null;
  label: string;
  active: boolean;
}

// ============ API CONFIGURATION ============
const API_BASE_URL = 'http://10.174.201.74:8000/api';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// ============ REQUEST INTERCEPTOR ============
api.interceptors.request.use(
  (config) => {
    const token = authStorage.getToken();
    
    // Skip auth for login
    const url = config.url || '';
    const skipAuth =
      url.includes('/auth/web-login') ||
      url.includes('/auth/register') ||
      url === '/availability' ||
      url.startsWith('/availability/');

    if (skipAuth) {
      return config;
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// ============ RESPONSE INTERCEPTOR ============
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config?._retry) {
      error.config._retry = true;
      
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/web-login') || 
                            url.includes('/auth/register');
      
      if (!isAuthEndpoint) {
        authStorage.clearAll();
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

// ============ AUTH API (WEB ONLY) ============
export const authAPI = {
  /**
   * Web login - Accepts all roles
   */
  webLogin: (data: { login: string; password: string }) =>
    api.post<ApiResponse<LoginResponse>>('/auth/web-login', data),

  /**
   * Register a new parishioner
   */
  register: (data: {
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    email: string;
    password: string;
    password_confirmation: string;
    contact_number?: string | null;
    address?: string | null;
  }) => api.post<ApiResponse<LoginResponse>>('/auth/register', data),

  /**
   * Logout
   */
  logout: () => api.post<ApiResponse<null>>('/auth/logout'),

  /**
   * Get user profile
   */
  profile: () => api.get<ApiResponse<User>>('/auth/profile'),

  /**
   * Verify token
   */
  verify: () => api.get<ApiResponse<{ user_id: number; full_name: string; email: string; role: string; is_verified: boolean }>>('/auth/verify'),

  /**
   * Update user profile
   */
  updateProfile: (data: {
    first_name?: string;
    middle_name?: string | null;
    last_name?: string;
    email?: string;
    contact_number?: string | null;
    address?: string | null;
    password?: string;
    password_confirmation?: string;
  }) => api.put<ApiResponse<User>>('/auth/profile', data),
};

// ============ USER / PRIEST / CASHIER MANAGEMENT (ADMIN) ============
export interface CreatePriestData {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  email: string;
  contact_number?: string | null;
  password: string;
}

export interface CreateCashierData {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  username: string;
  email?: string | null;
  contact_number?: string | null;
  password: string;
}

export const usersAPI = {
  listPriests: (options?: { activeOnly?: boolean; availableOnly?: boolean }) =>
    api.get<ApiResponse<PaginatedResponse<User>>>('/admin/users', {
      params: {
        role: 'priest',
        per_page: 100,
        ...(options?.activeOnly ? { active_only: 1 } : {}),
        ...(options?.availableOnly ? { available_only: 1 } : {}),
      },
    }),

  listCashiers: () =>
    api.get<ApiResponse<PaginatedResponse<User>>>('/admin/users', {
      params: {
        role: 'cashier',
        per_page: 100,
      },
    }),

  createPriest: (data: CreatePriestData) =>
    api.post<ApiResponse<User>>('/admin/create-priest', data),

  createCashier: (data: CreateCashierData) =>
    api.post<ApiResponse<User>>('/admin/create-cashier', data),

  disablePriest: (userId: number) =>
    api.post<ApiResponse<User>>(`/admin/users/${userId}/disable`),

  enablePriest: (userId: number) =>
    api.post<ApiResponse<User>>(`/admin/users/${userId}/enable`),

  disableCashier: (userId: number) =>
    api.post<ApiResponse<User>>(`/admin/users/${userId}/disable`),

  enableCashier: (userId: number) =>
    api.post<ApiResponse<User>>(`/admin/users/${userId}/enable`),

  updateAvailability: (isAvailable: boolean) =>
    api.put<ApiResponse<User>>('/priest/availability', { is_available: isAvailable }),
};

// Export types
export type { User, UserRole } from './AuthStorage';