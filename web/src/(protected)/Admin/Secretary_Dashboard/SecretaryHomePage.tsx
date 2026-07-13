import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";
import { manageRequestAPI, getStatusLabel } from "../../../../library/manage-request";
import type { ManageRequest } from "../../../../library/manage-request";
import type { User } from "../../../../library/api";
import {
  LayoutDashboard,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  Loader2,
  ClipboardList,
} from "lucide-react";
import PageHeader from "./components/PageHeader";
import SecretaryStatCard from "./components/SecretaryStatCard";
import StatusBadge from "./components/StatusBadge";
import EmptyState from "./components/EmptyState";
import { ServiceTypeIcon } from "./components/ServiceTypeIcon";

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
  if (request.service?.service_name) return request.service.service_name;
  if (request.baptismForm) return "Baptism";
  if (request.certificateForm) return "Certificate";
  if (request.serviceForm) return "Church Service";
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

const SecretaryHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const response = await manageRequestAPI.getAll({ page: 1, per_page: 100 });

      if (!response.data?.success) {
        throw new Error(response.data?.message || "Failed to fetch data");
      }

      const requests: ManageRequest[] = response.data?.data?.data || [];
      console.log("Secretary dashboard loaded requests:", requests.length);

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

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
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
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description={`Welcome back, ${user?.full_name || "Secretary"}. Here is your parish overview.`}
      />

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Request Summary
        </h2>
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
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <ClipboardList size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Recent Requests</h3>
              <p className="text-xs text-slate-500">{recentRequests.length} shown</p>
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
          {recentRequests.length > 0 ? (
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
    </div>
  );
};

export default SecretaryHomePage;
