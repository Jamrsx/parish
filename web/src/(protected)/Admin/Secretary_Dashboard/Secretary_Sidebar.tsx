import React, { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";
import { manageRequestAPI } from "../../../../library/manage-request";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Package,
  FileArchive,
  UserPlus,
  Menu,
  LogOut,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Church,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const navItems: { path: string; label: string; icon: LucideIcon }[] = [
  { path: "/admin/secretary/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/secretary/scheduled-services", label: "Scheduled Services", icon: CalendarDays },
  { path: "/admin/secretary/manage-requests", label: "Manage Requests", icon: ClipboardList },
  { path: "/admin/secretary/manage-inventory", label: "Manage Inventory", icon: Package },
  { path: "/admin/secretary/service-records", label: "Service Records", icon: FileArchive },
  { path: "/admin/secretary/manage-priests", label: "Manage Priests", icon: UserPlus },
];

const PENDING_POLL_INTERVAL_MS = 30000;

const SecretarySidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== "secretary")) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, user, authLoading, navigate]);

  const fetchPendingCount = useCallback(async () => {
    try {
      const response = await manageRequestAPI.getAll({ status: "pending", per_page: 1 });
      if (response.data?.success) {
        const data = response.data.data;
        let total = 0;
        if (data && typeof data === "object" && "total" in data) {
          total = Number(data.total) || 0;
        } else if (Array.isArray(data)) {
          total = data.length;
        }
        console.log("Sidebar pending requests count:", total);
        setPendingCount(total);
      }
    } catch (err) {
      console.error("Error fetching pending requests count:", err);
    }
  }, []);

  // Poll pending count and refresh whenever the secretary navigates
  useEffect(() => {
    if (authLoading || !isAuthenticated || user?.role !== "secretary") return;

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, PENDING_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [authLoading, isAuthenticated, user, fetchPendingCount, location.pathname]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "secretary") {
    return null;
  }

  const handleLogoutClick = () => {
    setShowLogoutMenu(false);
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 bg-opacity-20 backdrop-blur-sm"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-50 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Confirm Logout</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to logout from your secretary account?
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  autoFocus
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmLogout}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`${
            sidebarCollapsed ? "w-[72px]" : "w-64"
          } bg-white border-r border-slate-200 flex flex-col transition-all duration-300 shrink-0`}
        >
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2">
              {!sidebarCollapsed && (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <Church size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900 truncate leading-tight">
                      San Guillermo de Maleval Parish
                    </h2>
                    <p className="text-xs text-blue-600 font-medium mt-0.5">Secretary Portal</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 shrink-0"
                aria-label="Toggle sidebar"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              const showPendingIndicator =
                item.path === "/admin/secretary/manage-requests" && pendingCount > 0;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={
                    sidebarCollapsed
                      ? showPendingIndicator
                        ? `${item.label} (${pendingCount} pending)`
                        : item.label
                      : undefined
                  }
                  className={`w-full px-3 py-2.5 text-sm font-medium flex items-center gap-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                  } ${sidebarCollapsed ? "justify-center" : ""}`}
                >
                  <span className="relative shrink-0">
                    <Icon size={18} className="shrink-0" />
                    {showPendingIndicator && sidebarCollapsed && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white" />
                      </span>
                    )}
                  </span>
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {showPendingIndicator && (
                        <span
                          className={`flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
                            isActive ? "bg-white text-blue-700" : "bg-red-500 text-white"
                          }`}
                          aria-label={`${pendingCount} pending requests`}
                        >
                          {pendingCount > 99 ? "99+" : pendingCount}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-slate-200">
            <div className="relative">
              <button
                onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                className={`w-full px-3 py-2.5 text-sm font-medium flex items-center gap-3 rounded-lg text-slate-700 hover:bg-blue-50 transition-all ${
                  sidebarCollapsed ? "justify-center" : ""
                }`}
                aria-label="User menu"
              >
                <div
                  className={`${
                    sidebarCollapsed ? "w-9 h-9" : "w-8 h-8"
                  } bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0`}
                >
                  {user?.username?.charAt(0).toUpperCase() ||
                    user?.first_name?.charAt(0).toUpperCase() ||
                    "S"}
                </div>
                {!sidebarCollapsed && (
                  <>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">
                        {user?.username || user?.full_name || "Secretary User"}
                      </div>
                      <div className="text-xs text-blue-600 font-medium capitalize">
                        {user?.role || "Secretary"}
                      </div>
                    </div>
                    {showLogoutMenu ? (
                      <ChevronUp size={16} className="text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-slate-400 shrink-0" />
                    )}
                  </>
                )}
              </button>

              {showLogoutMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowLogoutMenu(false)} />
                  <div
                    className={`absolute ${
                      sidebarCollapsed ? "left-full ml-2 bottom-0" : "bottom-full mb-2 left-0"
                    } z-20 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden w-48`}
                  >
                    <button
                      onClick={handleLogoutClick}
                      className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-red-50 hover:text-red-600 flex items-center gap-2 transition-colors"
                    >
                      <LogOut size={16} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-6 max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default SecretarySidebar;
