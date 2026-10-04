import React, { useState } from "react";
import { CalendarCheck, History, Lock, Receipt, ScrollText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HistoryScope } from "../../../../../library/history";
import ServicesHistoryTab from "./ServicesHistoryTab";
import TransactionsHistoryTab from "./TransactionsHistoryTab";
import ActivityLogTab from "./ActivityLogTab";

type HistoryTab = "services" | "transactions" | "activity";

const TABS: { id: HistoryTab; label: string; icon: LucideIcon; hint: string }[] = [
  { id: "services", label: "Scheduled services", icon: CalendarCheck, hint: "Every service request and what happened to it" },
  { id: "transactions", label: "Church transactions", icon: Receipt, hint: "All money received and spent" },
  { id: "activity", label: "Activity log", icon: ScrollText, hint: "Who changed what, and when" },
];

interface ParishHistoryProps {
  scope: HistoryScope;
  /** Hide the page title when the host page already shows one (priest shell). */
  showTitle?: boolean;
}

const ParishHistory: React.FC<ParishHistoryProps> = ({ scope, showTitle = true }) => {
  const [tab, setTab] = useState<HistoryTab>("services");

  const selectTab = (next: HistoryTab) => {
    console.log("[ParishHistory] Tab:", next);
    setTab(next);
  };

  return (
    <div>
      {showTitle && (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <History size={24} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Parish History</h1>
              <p className="mt-1 text-sm text-slate-500 sm:text-base">
                The permanent record of scheduled services and church transactions.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <Lock size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
        <p>
          View only. Records here cannot be edited or deleted. To correct something, make the change on its own page
          and the change will be added to the history.
        </p>
      </div>

      <div role="tablist" aria-label="History sections" className="mb-5 flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon, hint }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              title={hint}
              onClick={() => selectTab(id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              <Icon size={16} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      {tab === "services" && <ServicesHistoryTab scope={scope} />}
      {tab === "transactions" && <TransactionsHistoryTab scope={scope} />}
      {tab === "activity" && <ActivityLogTab scope={scope} />}
    </div>
  );
};

export default ParishHistory;
