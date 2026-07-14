import { api, ApiResponse, Service } from './api';

export const churchServiceAPI = {
  /** Get all church services */
  async getServices(): Promise<ApiResponse<{ data: Service[] }>> {
    console.log('churchServiceAPI.getServices');
    return api.getServices();
  },

  /** Get service options grouped by type */
  async getServiceOptions(): Promise<
    ApiResponse<{
      all: Service[];
      grouped: { baptism: Service[]; certificate: Service[]; service_form: Service[] };
    }>
  > {
    console.log('churchServiceAPI.getServiceOptions');
    return api.getServiceOptions();
  },
};