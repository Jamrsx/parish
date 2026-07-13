import { api, ApiResponse, Service } from './api';

export const churchServiceAPI = {
  /**
   * Get all church services
   */
  async getServices(): Promise<ApiResponse<{ data: Service[] }>> {
    return api.getServices();
  },

  /**
   * Get service options grouped by type
   */
  async getServiceOptions(): Promise<
    ApiResponse<{
      all: Service[];
      grouped: { baptism: Service[]; certificate: Service[]; service_form: Service[] };
    }>
  > {
    return api.getServiceOptions();
  },
};