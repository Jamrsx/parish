import { api } from './api';

export interface MonthlyOverviewSummary {
  total_requests: number;
  pending: number;
  approved: number;
  completed: number;
  cancelled: number;
  unpaid_requests: number;
  service_fees_total: number;
  mass_collections_total: number;
  donations_total: number;
  special_intentions_total: number;
  total_income: number;
}

export interface ServiceActivityShare {
  service_type: string;
  request_count: number;
  completed_count: number;
  percentage: number;
}

export interface ServiceIncomeShare {
  service_type: string;
  amount: number;
  payment_count: number;
  percentage: number;
}

export interface OtherIncomeShare {
  label: string;
  amount: number;
  percentage: number;
}

export interface MonthlyOverviewData {
  year: number;
  month: number;
  month_label: string;
  period: { start: string; end: string };
  summary: MonthlyOverviewSummary;
  activity_by_service: ServiceActivityShare[];
  income_by_service: ServiceIncomeShare[];
  other_income: OtherIncomeShare[];
}

export const secretaryDashboardAPI = {
  getMonthlyOverview: (year?: number, month?: number) => {
    console.log('Fetching secretary monthly overview:', { year, month });
    return api.get<{ success: boolean; message?: string; data: MonthlyOverviewData }>(
      '/admin/secretary/monthly-overview',
      { params: { year, month } }
    );
  },
};
