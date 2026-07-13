import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";
import { manageRequestAPI, getStatusLabel } from "../../../../library/manage-request";
import type { RequestStatus, ManageRequest } from "../../../../library/manage-request";
import type { User } from "../../../../library/api";
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  ChevronRight,
  Loader2
} from "lucide-react";

// ============ TYPE DEFINITIONS ============
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

// ============ HELPER FUNCTIONS ============
const getUserFullName = (user: User | undefined | null): string => {
  if (!user) return 'N/A';
  if (user.full_name) return user.full_name;
  if (user.first_name) {
    const middle = user.middle_name ? ` ${user.middle_name}` : '';
    return `${user.first_name}${middle} ${user.last_name}`;
  }
  return 'N/A';
};

const getServiceDisplayName = (request: ManageRequest): string => {
  if (request.service?.service_name) {
    return request.service.service_name;
  }
  if (request.baptismForm) return 'Baptism';
  if (request.certificateForm) return 'Certificate';
  if (request.serviceForm) return 'Church Service';
  return 'Unknown';
};

const getRequestDisplayName = (request: ManageRequest): string => {
  if (request.baptismForm) {
    return `${request.baptismForm.child_first_name} ${request.baptismForm.child_last_name}`;
  }
  if (request.serviceForm) {
    return request.serviceForm.full_name;
  }
  if (request.certificateForm) {
    return request.certificateForm.full_name;
  }
  return getUserFullName(request.user);
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
};

const getStatusBadgeColor = (status: RequestStatus): string => {
  const colors: Record<RequestStatus, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    done: "bg-sky-100 text-sky-800 border-sky-200",
    cancelled: "bg-rose-100 text-rose-800 border-rose-200",
  };
  return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
};

const getServiceIcon = (serviceName: string): React.ReactNode => {
  const name = serviceName?.toLowerCase() || '';
  if (name.includes('baptism')) return <span className="text-xl">💧</span>;
  if (name.includes('funeral')) return <span className="text-xl">🕯️</span>;
  if (name.includes('marriage')) return <span className="text-xl">💒</span>;
  if (name.includes('house blessing') || name.includes('blessing')) return <span className="text-xl">🏠</span>;
  if (name.includes('certificate')) return <span className="text-xl">📜</span>;
  return <span className="text-xl">⛪</span>;
};

// ============ MAIN COMPONENT ============
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

  // ============ FETCH DATA ============
  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      
      const response = await manageRequestAPI.getAll({ 
        page: 1, 
        per_page: 100 
      });
      
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to fetch data');
      }

      const requests: ManageRequest[] = response.data?.data?.data || [];
      
      // Set recent requests (last 10)
      setRecentRequests(requests.slice(0, 10));
      
      // Calculate statistics
      const pending = requests.filter((r: ManageRequest) => r.status === 'pending');
      const approved = requests.filter((r: ManageRequest) => r.status === 'approved');
      const completed = requests.filter((r: ManageRequest) => r.status === 'done');
      const cancelled = requests.filter((r: ManageRequest) => r.status === 'cancelled');
      
      setStats({
        totalRequests: requests.length,
        pendingRequests: pending.length,
        approvedRequests: approved.length,
        completedRequests: completed.length,
        cancelledRequests: cancelled.length,
      });
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  // ============ INITIAL FETCH ============
  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // ============ LOADING STATE ============
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Loading dashboard...</p>
      </div>
    );
  }

  // ============ ERROR STATE ============
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 p-8">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-rose-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Unable to Load Dashboard</h3>
        <p className="text-gray-500 text-center max-w-md mb-6">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ============ RENDER ============
  return (
    <div className="space-y-8">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <span>📊</span>
            Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Welcome back, {user?.full_name || 'Secretary'}! Here's your overview.
          </p>
        </div>
      </div>

      {/* ============ STATS CARDS ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Requests"
          value={stats.totalRequests}
          icon={<FileText className="w-5 h-5" />}
          color="blue"
          onClick={() => navigate("/admin/secretary/manage-requests")}
        />
        <StatCard
          label="Pending"
          value={stats.pendingRequests}
          icon={<Clock className="w-5 h-5" />}
          color="amber"
          onClick={() => navigate("/admin/secretary/manage-requests?status=pending")}
        />
        <StatCard
          label="Approved"
          value={stats.approvedRequests}
          icon={<CheckCircle className="w-5 h-5" />}
          color="emerald"
          onClick={() => navigate("/admin/secretary/manage-requests?status=approved")}
        />
        <StatCard
          label="Completed"
          value={stats.completedRequests}
          icon={<TrendingUp className="w-5 h-5" />}
          color="sky"
          onClick={() => navigate("/admin/secretary/manage-requests?status=done")}
        />
      </div>

      {/* ============ RECENT REQUESTS ============ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <h3 className="text-lg font-semibold text-gray-800">
              Recent Requests
            </h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {recentRequests.length}
            </span>
          </div>
          <button
            onClick={() => navigate("/admin/secretary/manage-requests")}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="divide-y divide-gray-100 max-h-100 overflow-y-auto">
          {recentRequests.length > 0 ? (
            recentRequests.map((request) => (
              <div 
                key={request.request_id} 
                className="px-6 py-3 hover:bg-gray-50 transition cursor-pointer"
                onClick={() => navigate(`/admin/secretary/manage-requests?request=${request.request_id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      {getServiceIcon(getServiceDisplayName(request))}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {getServiceDisplayName(request)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {getRequestDisplayName(request)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">
                      {formatDate(request.created_at)}
                    </span>
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getStatusBadgeColor(request.status)}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-center text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No requests found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ SUB-COMPONENTS ============

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'amber' | 'emerald' | 'sky' | 'rose';
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, onClick }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    sky: 'bg-sky-50 border-sky-200 text-sky-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
  };

  const iconColors = {
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    sky: 'bg-sky-100 text-sky-600',
    rose: 'bg-rose-100 text-rose-600',
  };

  return (
    <div 
      className={`${colorClasses[color]} rounded-xl border p-5 hover:shadow-md transition cursor-pointer`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${iconColors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default SecretaryHomePage;