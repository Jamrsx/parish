import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";

const SecretarySidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Navigation items with correct paths
  const navItems = [
    { path: "/admin/secretary/dashboard", label: "Dashboard" },
    { path: "/admin/secretary/scheduled-services", label: "Scheduled Services" },
    { path: "/admin/secretary/manage-requests", label: "Manage Requests" },
    { path: "/admin/secretary/manage-inventory", label: "Manage Inventory" },
    { path: "/admin/secretary/service-records", label: "Service Records" },
  ];

  // Check authentication
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== "secretary")) {
      navigate("/login");
    }
  }, [isAuthenticated, user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
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
    navigate("/login");
  };

  const handleCancelLogout = () => {
    setShowLogoutModal(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleCancelLogout}
        >
          <div 
            className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg 
                  className="h-6 w-6 text-red-600" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Confirm Logout
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to logout from your secretary account?
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleCancelLogout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                  autoFocus
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmLogout}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={`${
            sidebarCollapsed ? "w-20" : "w-64"
          } bg-white border-r border-gray-200 shadow-sm flex flex-col transition-all duration-300`}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            {!sidebarCollapsed ? (
              <>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    San Guillermo de Maleval Parish
                  </h2>
                  <p className="text-gray-500 text-xs mt-0.5">Secretary Portal</p>
                </div>
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                  aria-label="Toggle sidebar"
                >
                  ☰
                </button>
              </>
            ) : (
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="w-full p-2 hover:bg-gray-100 rounded-lg text-gray-600 flex justify-center"
                aria-label="Toggle sidebar"
              >
                ☰
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 mt-6 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`w-full px-4 py-3 text-sm font-medium flex items-center gap-3 rounded-lg transition-all ${
                  location.pathname === item.path
                    ? "bg-blue-100 text-blue-700 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-gray-200">
            <div className="relative">
              <button
                onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                className={`w-full px-4 py-3 text-sm font-medium flex items-center gap-3 rounded-lg text-gray-700 hover:bg-blue-50 transition-all ${
                  sidebarCollapsed ? "justify-center" : ""
                }`}
                aria-label="User menu"
              >
                <div
                  className={`${
                    sidebarCollapsed ? "w-10 h-10" : "w-8 h-8"
                  } bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 shadow-sm`}
                >
                  {user?.username?.charAt(0).toUpperCase() || 
                   user?.first_name?.charAt(0).toUpperCase() || 
                   "S"}
                </div>
                {!sidebarCollapsed && (
                  <>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-gray-800">
                        {user?.username || user?.full_name || "Secretary User"}
                      </div>
                      <div className="text-xs text-blue-600 font-medium capitalize">
                        {user?.role || "Secretary"}
                      </div>
                    </div>
                    <span className="text-gray-400 text-lg">
                      {showLogoutMenu ? "✕" : "▼"}
                    </span>
                  </>
                )}
              </button>

              {showLogoutMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowLogoutMenu(false)}
                  />
                  <div 
                    className={`absolute ${
                      sidebarCollapsed 
                        ? 'left-full ml-2 bottom-0' 
                        : 'bottom-full mb-2 left-0'
                    } z-20 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden w-48`}
                  >
                    <button
                      onClick={handleLogoutClick}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 flex items-center gap-2 transition-colors"
                    >
                      <span className="text-lg">🚪</span>
                      <span>Sign out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-6">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecretarySidebar;