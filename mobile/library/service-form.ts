import { api, ApiResponse, ServiceForm } from './api';

export const serviceFormAPI = {
  /**
   * Create a new service form (Marriage, Funeral Mass, House Blessing)
   */
  async createServiceForm(data: {
    service_id: number;
    full_name: string;
    address: string;
    contact_number: string;
    preferred_date: string;
    preferred_time: string;
  }): Promise<ApiResponse<ServiceForm>> {
    return api.createServiceForm(data);
  },
};