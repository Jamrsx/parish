import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";
import { cashierAPI, type CashierDashboardData } from "../../../../library/cashier";
import ManageUnpaidRequest from "./Manage_Unpaid_Request";
import MassCollections from "./Mass_Financial";
import TransactionHistory from "./Transaction_History";
import DailyReport from "./Daily_Report";
import DonationHandover from "./Donation_Handover";

type TabId =
  | "dashboard"
  | "payments"
  | "transactions"
  | "daily-report"
  | "mass"
  | "donations";

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CashierHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [dashboard, setDashboard] = useState<CashierDashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);

  const cashierUser = {
    name: user?.username || user?.full_name || "Cashier",
    role: user?.role_label || "Cashier",
  };

  const fetchDashboard = useCallback(async () => {
    try {
      setLoadingDash(true);
      console.log("Fetching cashier dashboard...");
      const res = await cashierAPI.dashboard();
      if (res.data?.success) {
        setDashboard(res.data.data);
        console.log("Cashier dashboard loaded:", res.data.data);
      }
    } catch (err) {
      console.error("Cashier dashboard error:", err);
    } finally {
      setLoadingDash(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [activeTab, fetchDashboard]);

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    navigate("/login", { replace: true });
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "payments", label: "Collect Payments", icon: "💵" },
    { id: "transactions", label: "Transactions", icon: "🧾" },
    { id: "daily-report", label: "Daily Report", icon: "📅" },
    { id: "mass", label: "Mass Collections", icon: "⛪" },
    { id: "donations", label: "Donations", icon: "🤝" },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 bg-opacity-20 backdrop-blur-sm"
          onClick={() => setShowLogoutModal(false)}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-2 text-center">Confirm Logout</h3>
            <p className="text-sm text-slate-500 mb-6 text-center">Log out of the cashier account?</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowLogoutModal(false)} className="px-4 py-2 text-sm bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button onClick={handleConfirmLogout} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`${sidebarCollapsed ? "w-[72px]" : "w-64"} bg-white border-r border-slate-200 flex flex-col transition-all shrink-0`}
        >
          <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2">
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 truncate">San Guillermo de Maleval Parish</h2>
                <p className="text-xs text-emerald-600 font-medium mt-0.5">Cashier Portal</p>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
            >
              ☰
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-3 py-2.5 text-sm font-medium flex items-center gap-3 rounded-lg ${
                  activeTab === tab.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                } ${sidebarCollapsed ? "justify-center" : ""}`}
              >
                <span>{tab.icon}</span>
                {!sidebarCollapsed && <span>{tab.label}</span>}
                {!sidebarCollapsed && tab.id === "donations" && (dashboard?.pending_donations || 0) > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[11px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center">
                    {dashboard?.pending_donations}
                  </span>
                )}
                {!sidebarCollapsed && tab.id === "mass" && (dashboard?.pending_mass_collections || 0) > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[11px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center">
                    {dashboard?.pending_mass_collections}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-3 border-t border-slate-200 relative">
            <button
              onClick={() => setShowLogoutMenu(!showLogoutMenu)}
              className={`w-full px-3 py-2.5 text-sm flex items-center gap-3 rounded-lg hover:bg-emerald-50 ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
            >
              <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {cashierUser.name.charAt(0).toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-semibold truncate">{cashierUser.name}</div>
                  <div className="text-xs text-emerald-600">{cashierUser.role}</div>
                </div>
              )}
            </button>
            {showLogoutMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowLogoutMenu(false)} />
                <div className="absolute bottom-full mb-2 left-3 right-3 z-20 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => {
                      setShowLogoutMenu(false);
                      setShowLogoutModal(true);
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-red-50 hover:text-red-600"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto w-full">
            {activeTab === "dashboard" && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800">Cashier Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Cash collections for {dashboard?.date || "today"}
                    </p>
                  </div>
                  <button
                    onClick={fetchDashboard}
                    className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    Refresh
                  </button>
                </div>

                {loadingDash ? (
                  <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-xs font-semibold text-amber-700 uppercase">Awaiting Payment</p>
                        <p className="text-3xl font-bold text-slate-900 mt-2">{dashboard?.unpaid_count ?? 0}</p>
                        <p className="text-xs text-slate-500 mt-1">Unpaid / partial requests</p>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-xs font-semibold text-emerald-700 uppercase">Service Fees Today</p>
                        <p className="text-2xl font-bold text-slate-900 mt-2">
                          {formatPeso(dashboard?.service_payments_today || 0)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {dashboard?.service_payments_today_count || 0} cash receipt(s)
                        </p>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-xs font-semibold text-blue-700 uppercase">Mass Today</p>
                        <p className="text-2xl font-bold text-slate-900 mt-2">
                          {formatPeso(dashboard?.mass_collections_today || 0)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Mass offerings logged</p>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-xs font-semibold text-violet-700 uppercase">Pending Donations</p>
                        <p className="text-3xl font-bold text-slate-900 mt-2">{dashboard?.pending_donations ?? 0}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Received today: {formatPeso(dashboard?.donations_received_today || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100">
                          <h3 className="font-semibold text-slate-800">Recent Service Payments</h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {(dashboard?.recent_payments || []).length === 0 ? (
                            <p className="px-5 py-8 text-center text-slate-500 text-sm">No payments yet</p>
                          ) : (
                            dashboard?.recent_payments.map((p) => (
                              <div key={p.payment_id} className="px-5 py-3 flex justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-slate-800">{p.parishioner || "Parishioner"}</p>
                                  <p className="text-xs text-slate-500">
                                    {p.service_type} · {p.created_at ? new Date(p.created_at).toLocaleString() : ""}
                                  </p>
                                </div>
                                <p className="text-sm font-semibold text-emerald-700">{formatPeso(p.amount)}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100">
                          <h3 className="font-semibold text-slate-800">Recent Mass Collections</h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {(dashboard?.recent_mass_collections || []).length === 0 ? (
                            <p className="px-5 py-8 text-center text-slate-500 text-sm">No mass collections yet</p>
                          ) : (
                            dashboard?.recent_mass_collections.map((m) => (
                              <div key={m.collection_id} className="px-5 py-3 flex justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-slate-800">{m.mass_type}</p>
                                  <p className="text-xs text-slate-500">{m.mass_date}</p>
                                </div>
                                <p className="text-sm font-semibold text-blue-700">{formatPeso(m.amount)}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "payments" && <ManageUnpaidRequest />}
            {activeTab === "transactions" && <TransactionHistory />}
            {activeTab === "daily-report" && <DailyReport />}
            {activeTab === "mass" && <MassCollections onChanged={fetchDashboard} />}
            {activeTab === "donations" && <DonationHandover onChanged={fetchDashboard} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default CashierHomePage;
