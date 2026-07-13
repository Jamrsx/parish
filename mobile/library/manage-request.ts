import { api, ApiResponse, Request } from './api';

export const requestAPI = {
  /**
   * Create a new request
   */
  async createRequest(data: {
    user_id: number;
    service_id: number;
    baptism_form_id?: number;
    service_form_id?: number;
    certificate_form_id?: number;
  }): Promise<ApiResponse<Request>> {
    return api.createRequest(data);
  },
};