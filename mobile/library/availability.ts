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
}

export interface CertificateAvailability {
  id: number;
  title: string;
  description: string;
  processingTime: string;
  timeColor: string;
  navigateTo: string;
}

export const availabilityAPI = {
  /**
   * Get all service availability
   */
  getAvailability: async () => {
    return api.getAvailability();
  },
};