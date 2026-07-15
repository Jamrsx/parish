import AsyncStorage from '@react-native-async-storage/async-storage';

// BASE URL
const API_BASE_URL = 'http://10.174.201.74:8000/api';

// TYPES
export interface User {
  user_id: number;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name: string;
  email?: string;
  username?: string;
  contact_number?: string;
  address?: string;
  role: 'parishioner' | 'secretary' | 'cashier' | 'priest';
  role_label: string;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Service {
  service_id: number;
  service_type: string;
  fee: number;
  formatted_fee: string;
}

export interface Request {
  request_id: number;
  user_id: number;
  service_id: number;
  preferred_date: string;
  preferred_time: string;
  status: 'pending' | 'approved' | 'done' | 'cancelled';
  payment_status: 'unpaid' | 'partial' | 'paid';
  amount_paid: number;
  payment_date?: string | null;
  remaining_balance?: number;
  is_fully_paid?: boolean;
  service: Service & { service_name?: string; form_type?: string | null; form_handler?: string | null };
  form_type: string;
  form_type_label?: string;
  form_summary: string;
  can_be_rescheduled: boolean;
  cancelled_reason?: string | null;
  reschedule_reason?: string | null;
  reschedule_count?: number;
  rescheduled_by?: number | null;
  rescheduledBy?: User | null;
  approved_at?: string | null;
  completed_at?: string | null;
  formatted_preferred_date?: string | null;
  formatted_preferred_time?: string | null;
  created_at?: string;
  updated_at?: string;
  assignedPriest?: User | null;
  user?: User;
}

export interface BaptismForm {
  baptism_id: number;
  child_first_name: string;
  child_middle_name?: string;
  child_last_name: string;
  child_birth_date: string;
  child_birth_place?: string;
  mother_first_name: string;
  mother_middle_name?: string;
  mother_last_name: string;
  father_first_name: string;
  father_middle_name?: string;
  father_last_name: string;
  address: string;
  contact_number: string;
  preferred_date: string;
  preferred_time: string;
}

export interface Godparent {
  godparent_id: number;
  godparent_name: string;
  relationship: 'godfather' | 'godmother';
}

export interface ServiceForm {
  serviceform_id: number;
  service_id: number;
  full_name: string;
  address: string;
  contact_number: string;
  preferred_date: string;
  preferred_time: string;
}

export interface CertificateForm {
  certificate_id: number;
  service_id: number;
  full_name: string;
  birth_date?: string;
  marriage_date?: string;
  address: string;
  contact_number: string;
  preferred_date: string;
  preferred_time: string;
}

export interface Notification {
  notification_id: number;
  user_id: number;
  request_id: number;
  type: string;
  title: string;
  message: string;
  status: 'unread' | 'read';
  created_at: string;
  deleted_at?: string | null;
  request?: Request;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, string[]>;
  /** From Backend REQUEST_EXPIRY_MINUTES when returned by parishioner request APIs */
  expiry_minutes?: number;
}

// API CLIENT
class API {
  private token: string | null = null;

  async getToken(): Promise<string | null> {
    if (this.token) return this.token;
    this.token = await AsyncStorage.getItem('auth_token');
    return this.token;
  }

  async setToken(token: string): Promise<void> {
    this.token = token;
    await AsyncStorage.setItem('auth_token', token);
  }

  async removeToken(): Promise<void> {
    this.token = null;
    await AsyncStorage.removeItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = await this.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        await this.removeToken();
      }
      throw {
        status: response.status,
        data,
      };
    }

    return data;
  }

  // AUTH
async login(login: string, password: string): Promise<ApiResponse<{ user: User; token: string; role: string }>> {
  const response = await this.request<{ user: User; token: string; role: string }>('/auth/mobile-login', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  });
  if (response.success && response.data.token) {
    await this.setToken(response.data.token);
  }
  return response;
}

  async register(data: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    email: string;
    password: string;
    password_confirmation: string;
    contact_number?: string;
    address?: string;
  }): Promise<ApiResponse<{ user: User; token: string }>> {
    const response = await this.request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        first_name: data.first_name,
        middle_name: data.middle_name || null,
        last_name: data.last_name,
        email: data.email,
        password: data.password,
        password_confirmation: data.password_confirmation,
        contact_number: data.contact_number || null,
        address: data.address || null,
      }),
    });
    if (response.success && response.data.token) {
      await this.setToken(response.data.token);
    }
    return response;
  }

  async logout(): Promise<ApiResponse<null>> {
    try {
      const response = await this.request<null>('/auth/logout', { method: 'POST' });
      await this.removeToken();
      return response;
    } catch (error) {
      await this.removeToken();
      throw error;
    }
  }

  async profile(): Promise<ApiResponse<User>> {
    return this.request('/auth/profile');
  }

  async updateProfile(data: {
    first_name?: string;
    middle_name?: string | null;
    last_name?: string;
    contact_number?: string | null;
    address?: string | null;
    email?: string;
  }): Promise<ApiResponse<User>> {
    console.log('Updating parishioner profile:', data);
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async verify(): Promise<ApiResponse<{ user_id: number; full_name: string; email: string; role: string; is_verified: boolean }>> {
    return this.request('/auth/verify');
  }

  // BAPTISM
  async createBaptismForm(data: {
    child_first_name: string;
    child_middle_name?: string;
    child_last_name: string;
    child_birth_date: string;
    child_birth_place?: string;
    mother_first_name: string;
    mother_middle_name?: string;
    mother_last_name: string;
    father_first_name: string;
    father_middle_name?: string;
    father_last_name: string;
    address: string;
    contact_number: string;
    preferred_date: string;
    preferred_time: string;
  }): Promise<ApiResponse<BaptismForm>> {
    return this.request('/parishioner/baptism-forms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addGodparent(
    baptismId: number,
    data: { godparent_name: string; relationship: 'godfather' | 'godmother' }
  ): Promise<ApiResponse<Godparent>> {
    return this.request(`/parishioner/baptism-forms/${baptismId}/godparents`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async bulkAddGodparents(
    baptismId: number,
    data: { godparents: { godparent_name: string; relationship: 'godfather' | 'godmother' }[] }
  ): Promise<ApiResponse<Godparent[]>> {
    return this.request(`/parishioner/baptism-forms/${baptismId}/godparents/bulk`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // SERVICE FORM
  async createServiceForm(data: {
    service_id: number;
    full_name: string;
    address: string;
    contact_number: string;
    preferred_date: string;
    preferred_time: string;
  }): Promise<ApiResponse<ServiceForm>> {
    return this.request('/parishioner/service-forms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // CERTIFICATE FORM
  async createCertificateForm(data: {
    service_id: number;
    full_name: string;
    birth_date?: string;
    marriage_date?: string;
    address: string;
    contact_number: string;
    preferred_date: string;
    preferred_time: string;
  }): Promise<ApiResponse<CertificateForm>> {
    return this.request('/parishioner/certificate-forms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // REQUEST
  async createRequest(data: {
    user_id: number;
    service_id: number;
    baptism_form_id?: number;
    service_form_id?: number;
    certificate_form_id?: number;
  }): Promise<ApiResponse<Request>> {
    return this.request('/parishioner/manage-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PARISHIONER REQUESTS
  async getUserRequests(params?: {
    page?: number;
    per_page?: number;
    status?: string;
  }): Promise<
    ApiResponse<{
      current_page: number;
      data: Request[];
      total: number;
      last_page: number;
    }>
  > {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.per_page) query.append('per_page', String(params.per_page));
    if (params?.status && params.status !== 'all') query.append('status', params.status);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/parishioner/requests${suffix}`);
  }

  async getUserStatistics(): Promise<
    ApiResponse<{
      total_requests: number;
      pending: number;
      approved: number;
      completed: number;
      cancelled: number;
      unpaid: number;
      partial: number;
      paid: number;
    }>
  > {
    return this.request('/parishioner/statistics');
  }

  // NOTIFICATIONS
  async getNotifications(): Promise<
    ApiResponse<{
      current_page: number;
      data: Notification[];
      total: number;
    }>
  > {
    return this.request('/parishioner/notifications');
  }

  async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    return this.request('/parishioner/notifications/unread-count');
  }

  async markNotificationAsRead(notificationId: number): Promise<ApiResponse<null>> {
    return this.request(`/parishioner/notifications/${notificationId}/mark-read`, { method: 'POST' });
  }

  async markAllNotificationsAsRead(): Promise<ApiResponse<null>> {
    return this.request('/parishioner/notifications/mark-all-read', { method: 'POST' });
  }

  async deleteNotification(notificationId: number): Promise<ApiResponse<null>> {
    return this.request(`/parishioner/notifications/${notificationId}`, { method: 'DELETE' });
  }

  async getDeletedNotifications(): Promise<
    ApiResponse<{
      current_page: number;
      data: Notification[];
      total: number;
    }>
  > {
    return this.request('/parishioner/notifications/deleted');
  }

  async restoreNotification(notificationId: number): Promise<ApiResponse<null>> {
    return this.request(`/parishioner/notifications/${notificationId}/restore`, { method: 'POST' });
  }

  async expirePendingRequests(): Promise<
    ApiResponse<{ expired_count: number; expiry_minutes: number }>
  > {
    return this.request('/parishioner/manage-requests/expire-pending', { method: 'POST' });
  }

  async cancelOwnRequest(
    requestId: number,
    cancelled_reason: string
  ): Promise<ApiResponse<Request>> {
    return this.request(`/parishioner/requests/${requestId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelled_reason }),
    });
  }

  async createSpecialIntention(data: {
    parishioner_name: string;
    intention_text: string;
    intention_date: string;
    preferred_time: string;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/parishioner/special-intentions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMySpecialIntentions(): Promise<ApiResponse<any>> {
    return this.request('/parishioner/special-intentions');
  }

  // SERVICES
  async getServices(): Promise<ApiResponse<{ data: Service[] }>> {
    return this.request('/church-services');
  }

  async getServiceOptions(): Promise<
    ApiResponse<{
      all: Service[];
      grouped: { baptism: Service[]; certificate: Service[]; service_form: Service[] };
    }>
  > {
    return this.request('/church-services/options');
  }

  async getServiceByName(name: string): Promise<Service | null> {
    try {
      const response = await this.getServices();
      const service = response.data.data.find(
        (s: Service) => s.service_type === name
      );
      return service || null;
    } catch (error) {
      console.error('Error getting service by name:', error);
      return null;
    }
  }

  // AVAILABILITY
  async getAvailability(date?: string): Promise<ApiResponse<{ services: any[]; certificates: any[]; date: string }>> {
    const url = date ? `/availability?date=${date}` : '/availability';
    return this.request(url);
  }

  async getBookedTimeSlots(
    date: string,
    excludeRequestId?: number
  ): Promise<ApiResponse<{ date: string; booked_times: string[] }>> {
    const params = new URLSearchParams({ date });
    if (excludeRequestId) {
      params.set('exclude_request_id', String(excludeRequestId));
    }
    return this.request(`/availability/booked-slots?${params.toString()}`);
  }
}

export const api = new API();