import { api, ApiResponse, Godparent } from './api';

export const godparentAPI = {
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