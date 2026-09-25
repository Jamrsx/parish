import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";
import { manageRequestAPI, getStatusLabel } from "../../../../library/manage-request";
import type { ManageRequest } from "../../../../library/manage-request";
import {
  secretaryDashboardAPI,
  type MonthlyOverviewData,
} from "../../../../library/secretary-dashboard";
import type { User } from "../../../../library/api";
import {
  LayoutDashboard,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  ClipboardList,
  Wallet,
  CalendarRange,
  PieChart,
} from "lucide-react";
import PageHeader from "./components/PageHeader";
import SecretaryStatCard from "./components/SecretaryStatCard";
import StatusBadge from "./components/StatusBadge";
import EmptyState from "./components/EmptyState";
import { ServiceTypeIcon } from "./components/ServiceTypeIcon";
import { SecretaryListSkeleton, SecretaryStatSkeleton } from "./components/SecretarySkeletons";
import { DonutChart, HorizontalBarChart } from "../components/MonthlyCharts";

interface DashboardStats {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  completedRequests: number;
  cancelledRequests: number;
}

interface RequestWithUser extends ManageRequest {
  user?: User;
}

const getUserFullName = (user: User | undefined | null): string => {
  if (!user) return "N/A";
  if (user.full_name) return user.full_name;
  if (user.first_name) {
    const middle = user.middle_name ? ` ${user.middle_name}` : "";
    return `${user.first_name}${middle} ${user.last_name}`;
  }
  return "N/A";
};

const getServiceDisplayName = (request: ManageRequest): string => {
  const fromService =
    request.service?.service_name || request.service?.service_type || "";
  if (fromService) return fromService;

  if (request.baptismForm || request.form_type === "baptism") return "Baptism";

  if (request.certificateForm || request.form_type === "certificate") {
    const raw = (
      request.certificateForm?.certificate_type ||
      request.certificateForm?.certificate_type_label ||
      request.certificateForm?.service_name ||
      ""
    )
      .toString()
      .toLowerCase();
    if (raw.includes("marriage")) return "Marriage Certificate";
    if (raw.includes("baptism")) return "Baptismal Certificate";
    return "Certificate";
  }

  if (request.serviceForm || request.form_type === "service") {
    return "Church Service";
  }

  return "Unknown";
};

const getRequestDisplayName = (request: ManageRequest): string => {
  if (request.baptismForm) {
    return `${request.baptismForm.child_first_name} ${request.baptismForm.child_last_name}`;
  }
  if (request.serviceForm) return request.serviceForm.full_name;
  if (request.certificateForm) return request.certificateForm.full_name;
  return getUserFullName(request.user);
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
};

const formatPeso = (amount: number): string =>
  `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const monthInputValue = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

const SecretaryHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const now = new Date();

  const [recentRequests, setRecentRequests] = useState<RequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    completedRequests: 0,
    cancelledRequests: 0,
  });

  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [monthly, setMonthly] = useState<MonthlyOverviewData | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const response = await manageRequestAPI.getAll({ page: 1, per_page: 100 });

      if (!response.data?.success) {
        throw new Error(response.data?.message || "Failed to fetch data");
      }

      const requests: ManageRequest[] = response.data?.data?.data || [];
      console.log("Secretary dashboard loaded requests:", requests.length);
      console.log(
        "Recent request labels:",
        requests.slice(0, 10).map((r) => ({
          id: r.request_id,
          label: getServiceDisplayName(r),
          service_type: r.service?.service_type,
          service_name: r.service?.service_name,
        }))
      );

      setRecentRequests(requests.slice(0, 10));
      setStats({
        totalRequests: requests.length,
        pendingRequests: requests.filter((r) => r.status === "pending").length,
        approvedRequests: requests.filter((r) => r.status === "approved").length,
        completedRequests: requests.filter((r) => r.status === "done").length,
        cancelledRequests: requests.filter((r) => r.status === "cancelled").length,
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMonthlyOverview = useCallback(async () => {
    try {
      setMonthlyLoading(true);
      setMonthlyError(null);
      const res = await secretaryDashboardAPI.getMonthlyOverview(selectedYear, selectedMonth);
      console.log("Secretary monthly overview:", res.data?.data);
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to load monthly overview");
      }
      setMonthly(res.data.data);
    } catch (err) {
      console.error("Error fetching monthly overview:", err);
      setMonthly(null);
      setMonthlyError(err instanceof Error ? err.message : "Failed to load monthly overview");
    } finally {
      setMonthlyLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchMonthlyOverview();
  }, [fetchMonthlyOverview]);

  const handleMonthChange = (value: string) => {
    const [y, m] = value.split("-").map(Number);
    if (!y || !m) return;
    console.log("Secretary month filter changed:", y, m);
    setSelectedYear(y);
    setSelectedMonth(m);
  };

  const incomeSlices =
    monthly?.income_by_service.map((row) => ({
      label: row.service_type,
      value: row.amount,
      percentage: row.percentage,
    })) || [];

  const activityBars =
    monthly?.activity_by_service.map((row) => ({
      label: row.service_type,
      value: row.request_count,
      percentage: row.percentage,
    })) || [];

  return (
    <div className="space-y-8">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description={`Welcome back, ${user?.full_name || "Secretary"}. Here is your parish overview.`}
      />

      {error ? (
        <div className="flex flex-col items-center justify-center min-h-[280px] p-8 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Unable to Load Dashboard</h3>
          <p className="text-slate-500 text-center max-w-md mb-6">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            Try Again
          </button>
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Request Summary
            </h2>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SecretaryStatSkeleton key={`home-stat-skel-${index}`} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SecretaryStatCard
                  label="Total Requests"
                  value={stats.totalRequests}
                  icon={FileText}
                  onClick={() => navigate("/admin/secretary/manage-requests")}
                />
                <SecretaryStatCard
                  label="Pending"
                  value={stats.pendingRequests}
                  icon={Clock}
                  highlight={stats.pendingRequests > 0}
                  onClick={() => navigate("/admin/secretary/manage-requests?status=pending")}
                />
                <SecretaryStatCard
                  label="Approved"
                  value={stats.approvedRequests}
                  icon={CheckCircle}
                  onClick={() => navigate("/admin/secretary/manage-requests?status=approved")}
                />
                <SecretaryStatCard
                  label="Completed"
                  value={stats.completedRequests}
                  icon={ClipboardList}
                  onClick={() => navigate("/admin/secretary/service-records")}
                />
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <CalendarRange size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Monthly Activity</h2>
                  <p className="text-xs text-slate-500">
                    {monthly?.month_label || "Parish activity and income share"}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span className="font-medium">Month</span>
                <input
                  type="month"
                  value={monthInputValue(selectedYear, selectedMonth)}
                  max={monthInputValue(now.getFullYear(), now.getMonth() + 1)}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </label>
            </div>

            {monthlyError ? (
              <div className="bg-white rounded-xl border border-red-100 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-red-600">{monthlyError}</p>
                <button
                  type="button"
                  onClick={fetchMonthlyOverview}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            ) : monthlyLoading || !monthly ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SecretaryStatSkeleton key={`month-stat-skel-${index}`} />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <SecretaryStatCard
                    label="Requests this month"
                    value={monthly.summary.total_requests}
                    icon={FileText}
                  />
                  <SecretaryStatCard
                    label="Completed"
                    value={monthly.summary.completed}
                    icon={CheckCircle}
                  />
                  <SecretaryStatCard
                    label="Unpaid"
                    value={monthly.summary.unpaid_requests}
                    icon={Clock}
                    highlight={monthly.summary.unpaid_requests > 0}
                  />
                  <div className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                          Total income
                        </p>
                        <p className="mt-2 text-xl font-bold text-slate-900 truncate">
                          {formatPeso(monthly.summary.total_income)}
                        </p>
                      </div>
                      <div className="h-11 w-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Wallet size={20} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <PieChart size={18} className="text-blue-600" />
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Income by service</h3>
                        <p className="text-xs text-slate-500">
                          Service fees {formatPeso(monthly.summary.service_fees_total)}
                        </p>
                      </div>
                    </div>
                    <DonutChart
                      slices={incomeSlices}
                      centerLabel="Fees"
                      centerValue={formatPeso(monthly.summary.service_fees_total)}
                      emptyMessage="No service payments this month"
                    />
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <ClipboardList size={18} className="text-blue-600" />
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Requests by service</h3>
                        <p className="text-xs text-slate-500">Share of monthly bookings</p>
                      </div>
                    </div>
                    <HorizontalBarChart
                      bars={activityBars}
                      emptyMessage="No requests this month"
                      valueFormatter={(v) => `${v}`}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Other income this month</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {monthly.other_income.map((row) => (
                      <div
                        key={row.label}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                      >
                        <p className="text-xs text-slate-500">{row.label}</p>
                        <p className="text-base font-semibold text-slate-900 mt-1">
                          {formatPeso(row.amount)}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {row.percentage.toFixed(1)}% of total income
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Recent Requests</h3>
                  <p className="text-xs text-slate-500">
                    {loading ? " " : `${recentRequests.length} shown`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate("/admin/secretary/manage-requests")}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {loading && recentRequests.length === 0 ? (
                <SecretaryListSkeleton rows={6} />
              ) : recentRequests.length > 0 ? (
                recentRequests.map((request) => (
                  <button
                    key={request.request_id}
                    type="button"
                    className="w-full px-6 py-4 hover:bg-blue-50/50 transition text-left"
                    onClick={() =>
                      navigate(`/admin/secretary/manage-requests?request=${request.request_id}`)
                    }
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                          <ServiceTypeIcon
                            serviceName={getServiceDisplayName(request)}
                            formType={request.form_type}
                            size={18}
                          />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {getServiceDisplayName(request)}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {getRequestDisplayName(request)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-slate-400 hidden sm:inline">
                          {formatDate(request.created_at)}
                        </span>
                        <StatusBadge
                          status={request.status}
                          label={getStatusLabel(request.status)}
                        />
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <EmptyState
                  title="No requests found"
                  description="New parishioner requests will appear here."
                  icon={FileText}
                />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default SecretaryHomePage;
