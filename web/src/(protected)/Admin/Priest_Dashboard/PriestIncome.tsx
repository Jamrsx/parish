import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { priestAPI } from '../../../../library/priest';
import type { DailyReportData } from '../../../../library/cashier';
import { LogOut, RefreshCw } from 'lucide-react';
import PriestNav from './PriestNav';

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const massLabel = (m: { mass_type: string; mass_time?: string | null }) => {
  const time = m.mass_time
    ? (() => {
        const parts = String(m.mass_time).match(/(\d{1,2}):(\d{2})/);
        if (!parts) return m.mass_time;
        const h = parseInt(parts[1], 10);
        const min = parts[2];
        const ampm = h >= 12 ? 'PM' : 'AM';
        return `${h % 12 || 12}:${min} ${ampm}`;
      })()
    : '';
  return time ? `${m.mass_type} · ${time}` : m.mass_type;
};

const PriestIncome: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [date, setDate] = useState(todayLocal());
  const [report, setReport] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Priest income page loading:', date);
      const res = await priestAPI.getIncome(date);
      if (res.data?.success) {
        setReport(res.data.data);
      } else {
        setReport(null);
        setError(res.data?.message || 'Failed to load income.');
      }
    } catch (err) {
      console.error('Priest income error:', err);
      setReport(null);
      setError('Failed to load income. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <span>⛪</span> Priest Dashboard
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Welcome, {user?.full_name || 'Priest'} — parish income (view only)
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition self-start"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        <PriestNav />

        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Income</h2>
            <p className="text-sm text-slate-500 mt-1">
              Select today or a previous date. No changes can be made here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayLocal()}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            />
            <button
              type="button"
              onClick={fetchReport}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Load
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : !report ? (
          <p className="text-slate-500">Select a date to view income.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-emerald-700 uppercase">Service Fees</p>
                <p className="text-2xl font-bold mt-2">{formatPeso(report.service_fees_total)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-violet-700 uppercase">Donations</p>
                <p className="text-2xl font-bold mt-2">{formatPeso(report.donations_total)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase">Mass Collections</p>
                <p className="text-2xl font-bold mt-2">{formatPeso(report.mass_collections_total)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-700 uppercase">Special Intentions</p>
                <p className="text-2xl font-bold mt-2">
                  {formatPeso(report.special_intentions_total || 0)}
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex justify-between items-center">
              <span className="font-semibold text-blue-900">Total income for {report.date}</span>
              <span className="text-2xl font-bold text-blue-900">
                {formatPeso(report.income_for_date)}
              </span>
            </div>

            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 font-semibold">Service Fee Payments</div>
              {report.service_payments.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">None</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {report.service_payments.map((p) => (
                    <li key={p.payment_id} className="px-4 py-3 flex justify-between text-sm gap-3">
                      <span>
                        {p.parishioner} · {p.service_type}
                      </span>
                      <span className="font-semibold shrink-0">{formatPeso(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 font-semibold">Donations Confirmed</div>
              {report.donations.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">None</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {report.donations.map((d) => (
                    <li key={d.donation_id} className="px-4 py-3 flex justify-between text-sm gap-3">
                      <span>{d.donor_name}</span>
                      <span className="font-semibold shrink-0">{formatPeso(d.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 font-semibold">Mass Collections</div>
              {report.mass_collections.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">None</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {report.mass_collections.map((m) => (
                    <li key={m.collection_id} className="px-4 py-3 flex justify-between text-sm gap-3">
                      <span>{massLabel(m)}</span>
                      <span className="font-semibold shrink-0">{formatPeso(m.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 font-semibold">
                Special Intentions Confirmed
              </div>
              {(report.special_intentions || []).length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">None</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {report.special_intentions.map((row) => (
                    <li key={row.intention_id} className="px-4 py-3 flex justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium">{row.parishioner_name}</span>
                        <span className="block text-slate-500 truncate">{row.intention_text}</span>
                      </span>
                      <span className="font-semibold shrink-0">{formatPeso(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriestIncome;
