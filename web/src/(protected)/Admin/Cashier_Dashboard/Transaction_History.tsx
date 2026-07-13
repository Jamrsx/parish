import React, { useCallback, useEffect, useState } from "react";
import { cashierAPI, type PaymentTransactionRow } from "../../../../library/cashier";

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TransactionHistory: React.FC = () => {
  const [rows, setRows] = useState<PaymentTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Fetching payment transactions...");
      const res = await cashierAPI.transactions({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search || undefined,
        per_page: 50,
      });
      if (res.data?.success) {
        const data = res.data.data;
        setRows(Array.isArray(data) ? data : data?.data || []);
      }
    } catch (err) {
      console.error("Transactions error:", err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, search]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Transaction History</h1>
        <p className="text-sm text-slate-500 mt-1">All cash payments for church services</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parishioner, service, OR..."
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
        <button onClick={fetchRows} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">
          Filter
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-slate-500">No transactions found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Parishioner</th>
                  <th className="text-left px-4 py-3">Service</th>
                  <th className="text-left px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">OR No.</th>
                  <th className="text-left px-4 py-3">Received by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.payment_id}>
                    <td className="px-4 py-3 text-slate-500">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.parishioner || "—"}</td>
                    <td className="px-4 py-3">{row.service_type || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{formatPeso(row.amount)}</td>
                    <td className="px-4 py-3">{row.or_number || "—"}</td>
                    <td className="px-4 py-3">{row.received_by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionHistory;
