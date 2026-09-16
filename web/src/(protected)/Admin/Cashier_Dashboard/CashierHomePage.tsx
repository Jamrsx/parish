import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  CalendarDays,
  Church,
  HandCoins,
  BookOpen,
  Menu,
  LogOut,
  PieChart,
  CalendarRange,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../../../../context/AuthContext";
import { cashierAPI, type CashierDashboardData } from "../../../../library/cashier";
import type { MonthlyOverviewData } from "../../../../library/secretary-dashboard";
import ManageUnpaidRequest from "./Manage_Unpaid_Request";
import MassCollections from "./Mass_Financial";
import TransactionHistory from "./Transaction_History";
import DailyReport from "./Daily_Report";
import DonationHandover from "./Donation_Handover";
import SpecialIntentionHandover from "./Special_Intention_Handover";
import { CashierListSkeleton, CashierStatSkeleton } from "./CashierSkeletons";
import { DonutChart, HorizontalBarChart } from "../components/MonthlyCharts";

type TabId =
  | "dashboard"
  | "payments"
  | "transactions"
  | "daily-report"
  | "mass"
  | "donations"
  | "intentions";

const VALID_TABS: TabId[] = [
  "dashboard",
  "payments",
  "transactions",
  "daily-report",
  "mass",
  "donations",
  "intentions",
];

const isValidTab = (value: string | null): value is TabId =>
  VALID_TABS.includes(value as TabId);

const navGroups: {
  id: string;
  label: string;
  items: { id: TabId; label: string; icon: LucideIcon }[];
}[] = [
  {
    id: "overview",
    label: "Overview",
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    id: "payments",
    label: "Payments",
    items: [
      { id: "payments", label: "Collect Payments", icon: Wallet },
      { id: "transactions", label: "Transactions", icon: Receipt },
      { id: "daily-report", label: "Daily Report", icon: CalendarDays },
    ],
  },
  {
    id: "collections",
    label: "Collections",
    items: [
      { id: "mass", label: "Mass Collections", icon: Church },
      { id: "donations", label: "Donations", icon: HandCoins },
      { id: "intentions", label: "Special Intentions", icon: BookOpen },
    ],
  },
];

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const monthInputValue = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

const CashierHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const now = new Date();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [dashboard, setDashboard] = useState<CashierDashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [monthly, setMonthly] = useState<MonthlyOverviewData | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);

  const activeTab: TabId = useMemo(() => {
    const tab = searchParams.get("tab");
    return isValidTab(tab) ? tab : "dashboard";
  }, [searchParams]);

  const setActiveTab = (tabId: TabId) => {
    console.log("Cashier sidebar navigate:", tabId);
    if (tabId === "dashboard") {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ tab: tabId }, { replace: true });
  };

  const cashierUser = {
    name: user?.username || user?.full_name || "Cashier",
    role: user?.role_label || "Cashier",
  };

  const getPendingCount = (tabId: TabId): number => {
    if (!dashboard) return 0;
    if (tabId === "donations") return dashboard.pending_donations || 0;
    if (tabId === "mass") return dashboard.pending_mass_collections || 0;
    if (tabId === "intentions") return dashboard.pending_special_intentions || 0;
    return 0;
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

  const fetchMonthlyOverview = useCallback(async () => {
    try {
      setMonthlyLoading(true);
      setMonthlyError(null);
      const res = await cashierAPI.monthlyOverview(selectedYear, selectedMonth);
      console.log("Cashier monthly overview:", res.data?.data);
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to load monthly overview");
      }
      setMonthly(res.data.data);
    } catch (err) {
      console.error("Cashier monthly overview error:", err);
      setMonthly(null);
      setMonthlyError(err instanceof Error ? err.message : "Failed to load monthly overview");
    } finally {
      setMonthlyLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchDashboard();
  }, [activeTab, fetchDashboard]);

  useEffect(() => {
    if (activeTab === "dashboard") {
      fetchMonthlyOverview();
    }
  }, [activeTab, fetchMonthlyOverview]);

  const handleMonthChange = (value: string) => {
    const [y, m] = value.split("-").map(Number);
    if (!y || !m) return;
    console.log("Cashier month filter changed:", y, m);
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
                    <p className="text-xs text-blue-600 font-medium mt-0.5">Cashier Portal</p>
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

          <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
            {navGroups.map((group) => (
              <div key={group.id}>
                {!sidebarCollapsed && (
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </p>
                )}
                {sidebarCollapsed && group.id !== "overview" && (
                  <div className="mx-2 mb-2 border-t border-slate-100" aria-hidden />
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    const pendingCount = getPendingCount(item.id);
                    const showPending = pendingCount > 0;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        title={
                          sidebarCollapsed
                            ? showPending
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
                          {showPending && sidebarCollapsed && (
                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white" />
                            </span>
                          )}
                        </span>
                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1 text-left">{item.label}</span>
                            {showPending && (
                              <span
                                className={`flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
                                  isActive ? "bg-white text-blue-700" : "bg-red-500 text-white"
                                }`}
                                aria-label={`${pendingCount} pending`}
                              >
                                {pendingCount > 99 ? "99+" : pendingCount}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-3 border-t border-slate-200 relative">
            <button
              type="button"
              onClick={() => setShowLogoutMenu(!showLogoutMenu)}
              className={`w-full px-3 py-2.5 text-sm flex items-center gap-3 rounded-lg hover:bg-blue-50 ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
              aria-label="User menu"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {cashierUser.name.charAt(0).toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-semibold truncate">{cashierUser.name}</div>
                  <div className="text-xs text-blue-600">{cashierUser.role}</div>
                </div>
              )}
            </button>
            {showLogoutMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowLogoutMenu(false)} />
                <div className="absolute bottom-full mb-2 left-3 right-3 z-20 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogoutMenu(false);
                      setShowLogoutModal(true);
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-red-50 hover:text-red-600 flex items-center gap-2"
                  >
                    <LogOut size={16} />
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
                    onClick={() => {
                      fetchDashboard();
                      fetchMonthlyOverview();
                    }}
                    disabled={loadingDash || monthlyLoading}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>

                {loadingDash && !dashboard ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <CashierStatSkeleton key={`dash-stat-skel-${index}`} />
                      ))}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {["Recent Service Payments", "Recent Mass Collections"].map((title) => (
                        <div
                          key={title}
                          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                        >
                          <div className="px-5 py-3 border-b border-slate-100">
                            <h3 className="font-semibold text-slate-800">{title}</h3>
                          </div>
                          <div className="divide-y divide-slate-100">
                            <CashierListSkeleton rows={5} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-xs font-semibold text-amber-700 uppercase">Awaiting Payment</p>
                        <p className="text-3xl font-bold text-slate-900 mt-2">
                          {dashboard?.unpaid_count ?? 0}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Unpaid / partial requests</p>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-xs font-semibold text-blue-700 uppercase">Service Fees Today</p>
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
                        <p className="text-3xl font-bold text-slate-900 mt-2">
                          {dashboard?.pending_donations ?? 0}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Received today: {formatPeso(dashboard?.donations_received_today || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="mb-8 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <CalendarRange size={18} />
                          </div>
                          <div>
                            <h2 className="text-base font-semibold text-slate-900">Monthly Income</h2>
                            <p className="text-xs text-slate-500">
                              {monthly?.month_label || "Income share by service"}
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
                        <div className="bg-white rounded-xl border border-red-100 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                            <CashierStatSkeleton key={`month-stat-skel-${index}`} />
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                              <p className="text-xs font-semibold text-slate-500 uppercase">Total income</p>
                              <p className="text-2xl font-bold text-slate-900 mt-2">
                                {formatPeso(monthly.summary.total_income)}
                              </p>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                              <p className="text-xs font-semibold text-blue-700 uppercase">Service fees</p>
                              <p className="text-2xl font-bold text-slate-900 mt-2">
                                {formatPeso(monthly.summary.service_fees_total)}
                              </p>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                              <p className="text-xs font-semibold text-blue-700 uppercase">Mass + donations</p>
                              <p className="text-2xl font-bold text-slate-900 mt-2">
                                {formatPeso(
                                  monthly.summary.mass_collections_total +
                                    monthly.summary.donations_total
                                )}
                              </p>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                              <p className="text-xs font-semibold text-amber-700 uppercase">Unpaid requests</p>
                              <p className="text-3xl font-bold text-slate-900 mt-2">
                                {monthly.summary.unpaid_requests}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                              <div className="flex items-center gap-2 mb-4">
                                <PieChart size={18} className="text-blue-600" />
                                <div>
                                  <h3 className="text-sm font-semibold text-slate-900">Income by service</h3>
                                  <p className="text-xs text-slate-500">
                                    Percentage of service fees this month
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
                                <Receipt size={18} className="text-blue-600" />
                                <div>
                                  <h3 className="text-sm font-semibold text-slate-900">Requests by service</h3>
                                  <p className="text-xs text-slate-500">Monthly booking volume</p>
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
                                <p className="text-sm font-semibold text-blue-700">{formatPeso(p.amount)}</p>
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
            {activeTab === "intentions" && <SpecialIntentionHandover onChanged={fetchDashboard} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default CashierHomePage;
