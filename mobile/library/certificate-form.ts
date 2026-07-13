import { api, ApiResponse, CertificateForm } from './api';

export const certificateAPI = {
  /**
   * Create a new certificate form (Baptismal or Marriage)
   */
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
    return api.createCertificateForm(data);
  },
};