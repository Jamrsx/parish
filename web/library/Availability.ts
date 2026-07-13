import { api } from './api';

export interface ServiceAvailability {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: string;
  statusColor: string;
  slotsRemaining: string;
  nextDate: string;
  progress: number;
  buttonText: string;
  disabled: boolean;
  navigateTo: string;
  isAvailable: boolean;
  remainingSlots: number;
  dailyLimit: number;
  date?: string;
}

export interface CertificateAvailability {
  id: number;
  title: string;
  description: string;
  processingTime: string;
  timeColor: string;
  navigateTo: string;
}

export interface AvailabilityResponse {
  success: boolean;
  message?: string;
  data: {
    services: ServiceAvailability[];
    certificates: CertificateAvailability[];
    date?: string;
  };
}

export const availabilityAPI = {
  /**
   * Get availability for all services - PUBLIC ENDPOINT
   */
  getAvailability: async (): Promise<AvailabilityResponse> => {
    const response = await api.get<AvailabilityResponse>('/availability');
    return response.data;
  },

  /**
   * Get availability for a specific service
   */
  getServiceAvailability: (serviceType: string, date?: string) => {
    return api.get<ApiResponse<{ 
      service: { id: number; type: string; fee: number; formatted_fee: string };
      availability: ServiceAvailability;
      next_available_date: string | null;
      date: string;
    }>>(`/availability/${encodeURIComponent(serviceType)}`, { params: { date } });
  },

  /**
   * Get availability for a date range
   */
  getAvailabilityRange: (data: { service_id: number; start_date: string; end_date: string }) => {
    return api.get<ApiResponse<{
      service: { id: number; type: string; daily_limit: number };
      availability: Array<{
        date: string;
        date_formatted: string;
        day: string;
        is_available: boolean;
        remaining_slots: number;
        daily_limit: number;
        bookings: number;
      }>;
    }>>('/availability/range', { params: data });
  }
};

// For backward compatibility
export type { ApiResponse } from './api';