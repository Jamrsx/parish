import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";
import ManageUnpaidRequest from "./Manage_Unpaid_Request";
import MassFinancial from "./Mass_Financial";

const initialTransactions: Transaction[] = [
  {
    id: 1,
    donorName: "John Santos",
    amount: 5000,
    type: "donation",
    date: "2024-03-20",
    status: "completed",
  },
  {
    id: 2,
    donorName: "Maria Reyes",
    amount: 3000,
    type: "donation",
    date: "2024-03-19",
    status: "completed",
  },
  {
    id: 3,
    donorName: "Robert Cruz",
    amount: 2000,
    type: "payment",
    date: "2024-03-18",
    status: "pending",
  },
];

interface Transaction {
  id: number;
  donorName: string;
  amount: number;
  type: "donation" | "payment";
  date: string;
  status: "completed" | "pending";
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "requests" | "mass-financials">("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [transactions] = useState<Transaction[]>(initialTransactions);

  // ✅ FIXED: Get cashier user data from context - use role_label from user
  const cashierUser = {
    name: user?.username || user?.full_name || "Cashier User",
    role: user?.role_label || "Cashier",
  };

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      try {
        await logout();
        navigate("/login");
      } catch (error) {
        console.error("Logout failed:", error);
      }
    }
  };

  const totalDonations = transactions
    .filter(t => t.type === "donation" && t.status === "completed")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalPayments = transactions
    .filter(t => t.type === "payment" && t.status === "completed")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const netIncome = totalDonations + totalPayments;

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "requests", label: "Manage Requests", icon: "📋" },
    { id: "mass-financials", label: "Mass Records", icon: "⛪" },
  ] as const;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={`${
            sidebarCollapsed ? "w-20" : "w-64"
          } bg-white border-r border-gray-200 shadow-sm flex flex-col transition-all duration-300`}
        >
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            {!sidebarCollapsed ? (
              <>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    San Guillermo de Maleval Parish
                  </h2>
                  <p className="text-gray-500 text-xs mt-0.5">Cashier Portal</p>
                </div>
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                >
                  ☰
                </button>
              </>
            ) : (
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="w-full p-2 hover:bg-gray-100 rounded-lg text-gray-600 flex justify-center"
              >
                ☰
              </button>
            )}
          </div>

          <nav className="flex-1 mt-6 px-3 space-y-1 overflow-y-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-4 py-3 text-sm font-medium flex items-center gap-3 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? "bg-green-100 text-green-700 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                {!sidebarCollapsed && <span>{tab.label}</span>}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="relative">
              <button
                onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                className={`w-full px-4 py-3 text-sm font-medium flex items-center gap-3 rounded-lg text-gray-700 hover:bg-green-50 ${
                  sidebarCollapsed ? "justify-center" : ""
                }`}
              >
                <div
                  className={`${
                    sidebarCollapsed ? "w-10 h-10" : "w-8 h-8"
                  } bg-linear-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 shadow-sm`}
                >
                  {cashierUser.name.charAt(0).toUpperCase()}
                </div>
                {!sidebarCollapsed && (
                  <>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-gray-800">
                        {cashierUser.name}
                      </div>
                      <div className="text-xs text-green-600 font-medium">
                        {cashierUser.role}
                      </div>
                    </div>
                    <span className="text-gray-400 text-lg">
                      {showLogoutMenu ? "▼" : "▲"}
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
                  <div className="absolute bottom-full mb-2 left-0 right-0 z-20 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={handleLogout}
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
            {activeTab === "dashboard" ? (
              <div>
                {/* Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                  <div className="bg-linear-to-br from-green-50 to-green-100 rounded-xl shadow-sm p-5 border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-700 text-sm font-semibold uppercase tracking-wide">
                          Total Donations
                        </p>
                        <p className="text-3xl font-bold text-green-900 mt-2">
                          ₱{totalDonations.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-4xl text-green-600">💰</div>
                    </div>
                  </div>

                  <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm p-5 border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-700 text-sm font-semibold uppercase tracking-wide">
                          Total Payments
                        </p>
                        <p className="text-3xl font-bold text-blue-900 mt-2">
                          ₱{totalPayments.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-4xl text-blue-600">💳</div>
                    </div>
                  </div>

                  <div className="bg-linear-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm p-5 border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-700 text-sm font-semibold uppercase tracking-wide">
                          Net Income
                        </p>
                        <p className="text-3xl font-bold text-purple-900 mt-2">
                          ₱{netIncome.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-4xl text-purple-600">📈</div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-linear-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📋</span>
                      <h3 className="text-lg font-semibold text-gray-800">
                        Recent Transactions
                      </h3>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {transactions.length > 0 ? (
                      transactions.slice(0, 5).map((transaction) => (
                        <div key={transaction.id} className="px-6 py-3 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {transaction.donorName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {transaction.type} • {transaction.date}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900">
                                ₱{transaction.amount.toLocaleString()}
                              </p>
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  transaction.status === "completed"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {transaction.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-6 py-8 text-center text-gray-500">
                        No recent transactions
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : activeTab === "requests" ? (
              <ManageUnpaidRequest />
            ) : (
              <MassFinancial />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;