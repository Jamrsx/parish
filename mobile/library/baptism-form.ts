import { api, ApiResponse, BaptismForm, Godparent } from './api';

export const baptismAPI = {
  /**
   * Create a new baptism form
   */
  async createBaptismForm(data: {
    child_first_name: string;
    child_middle_name?: string;
    child_last_name: string;
    child_birth_date: string;
    child_birth_place: string;
    mother_first_name: string;
    mother_last_name: string;
    father_first_name: string;
    father_last_name: string;
    address: string;
    contact_number: string;
    preferred_date: string;
    preferred_time: string;
  }): Promise<ApiResponse<BaptismForm>> {
    return api.createBaptismForm(data);
  },

  /**
   * Add a single godparent
   */
  async addGodparent(
    baptismId: number, 
    data: { godparent_name: string; relationship: 'godfather' | 'godmother' }
  ): Promise<ApiResponse<Godparent>> {
    return api.addGodparent(baptismId, data);
  },

  /**
   * Bulk add multiple godparents
   */
  async bulkAddGodparents(
    baptismId: number,
    data: { godparents: { godparent_name: string; relationship: 'godfather' | 'godmother' }[] }
  ): Promise<ApiResponse<Godparent[]>> {
    return api.bulkAddGodparents(baptismId, data);
  },
};