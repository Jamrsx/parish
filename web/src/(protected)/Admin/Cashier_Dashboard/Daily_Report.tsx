import React, { useCallback, useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import { cashierAPI, type DailyReportData, type MassCollectionRow } from "../../../../library/cashier";
import {
  downloadCashCountPdf,
  formatMassTimeLabel,
  isFuneralLabel,
  massCollectionLabel,
} from "../../../../library/cashCountPdf";

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const DailyReport: React.FC = () => {
  const [date, setDate] = useState(todayLocal());
  const [report, setReport] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<"full-day" | number | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Fetching daily report for:", date);
      const res = await cashierAPI.dailyReport(date);
      if (res.data?.success) {
        setReport(res.data.data);
      }
    } catch (err) {
      console.error("Daily report error:", err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleFullDayPdf = () => {
    if (!report) {
      alert("Load a daily report first before generating the PDF.");
      return;
    }
    try {
      setGeneratingPdf("full-day");
      console.log("Generating full-day cash count PDF for:", report.date);
      downloadCashCountPdf(report, { mode: "full-day" });
    } catch (err) {
      console.error("Cash count PDF error:", err);
      alert("Could not generate the full-day Cash Count Form PDF. Please try again.");
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handlePerMassPdf = (mass: MassCollectionRow) => {
    if (!report) return;
    try {
      setGeneratingPdf(mass.collection_id);
      console.log("Generating per-mass cash count PDF:", {
        collection_id: mass.collection_id,
        mass_type: mass.mass_type,
        mass_time: mass.mass_time,
      });
      downloadCashCountPdf(report, {
        mode: "per-mass",
        massCollectionId: mass.collection_id,
        timeLabel: formatMassTimeLabel(mass.mass_time),
        holyMassLabel: mass.mass_type,
      });
    } catch (err) {
      console.error("Per-mass cash count PDF error:", err);
      alert("Could not generate the per-mass Cash Count Form PDF. Please try again.");
    } finally {
      setGeneratingPdf(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Daily Income Report</h1>
          <p className="text-sm text-slate-500 mt-1">
            Service fees, donations, mass collections, and special intentions
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
          <button
            type="button"
            onClick={fetchReport}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
          >
            Load
          </button>
          <button
            type="button"
            onClick={handleFullDayPdf}
            disabled={!report || loading || generatingPdf !== null}
            className="px-4 py-2 bg-white border border-emerald-600 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            title="All income for this date (Basket, Kalag, SI, donations, fees)"
          >
            <FileDown size={16} />
            {generatingPdf === "full-day" ? "Generating..." : "Full Day PDF"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        </div>
      ) : !report ? (
        <p className="text-slate-500">Select a date to view the report.</p>
      ) : (
        <div className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-900">
            <p className="font-medium">Cash Count PDF</p>
            <p className="mt-1 text-emerald-800/90">
              <strong>Full Day PDF</strong> = all income for the date.{" "}
              <strong>Per Mass PDF</strong> (on each mass row) = that Holy Mass only — fills Time and
              Holy Mass No./Name. Basket = offering · Kalag = funeral · Love Offering = donations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-700 uppercase">Service Fees</p>
              <p className="text-2xl font-bold mt-2">{formatPeso(report.service_fees_total)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-violet-700 uppercase">Donations Received</p>
              <p className="text-2xl font-bold mt-2">{formatPeso(report.donations_total)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-700 uppercase">Mass Collections</p>
              <p className="text-2xl font-bold mt-2">{formatPeso(report.mass_collections_total)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase">Special Intentions</p>
              <p className="text-2xl font-bold mt-2">{formatPeso(report.special_intentions_total || 0)}</p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center">
            <span className="font-semibold text-emerald-900">Income for {report.date}</span>
            <span className="text-2xl font-bold text-emerald-900">{formatPeso(report.income_for_date)}</span>
          </div>

          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold">Service Fee Payments</div>
            {report.service_payments.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">None</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {report.service_payments.map((p) => (
                  <li key={p.payment_id} className="px-4 py-3 flex justify-between text-sm">
                    <span>
                      {p.parishioner} · {p.service_type}
                    </span>
                    <span className="font-semibold">{formatPeso(p.amount)}</span>
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
                  <li key={d.donation_id} className="px-4 py-3 flex justify-between text-sm">
                    <span>{d.donor_name}</span>
                    <span className="font-semibold">{formatPeso(d.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <span className="font-semibold">Mass Collections</span>
              <span className="text-xs text-slate-500">Per-mass Cash Count uses Time + Holy Mass from each row</span>
            </div>
            {report.mass_collections.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">None</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {report.mass_collections.map((m) => (
                  <li
                    key={m.collection_id}
                    className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{massCollectionLabel(m)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isFuneralLabel(m.mass_type) ? "Kalag (funeral)" : "Basket (offering)"}
                        {m.mass_date ? ` · mass date ${m.mass_date}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold">{formatPeso(m.amount)}</span>
                      <button
                        type="button"
                        onClick={() => handlePerMassPdf(m)}
                        disabled={generatingPdf !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 text-xs font-medium hover:bg-emerald-50 disabled:opacity-50"
                        title={`Cash Count PDF for ${massCollectionLabel(m)}`}
                      >
                        <FileDown size={14} />
                        {generatingPdf === m.collection_id ? "..." : "Per Mass PDF"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold">Special Intentions Confirmed</div>
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
  );
};

export default DailyReport;
