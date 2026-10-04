import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PageMeta {
  total: number;
  lastPage: number;
  from: number;
  to: number;
}

interface HistoryPaginationProps {
  page: number;
  meta: PageMeta;
  noun: string;
  pluralNoun?: string;
  loading: boolean;
  onPage: (page: number) => void;
}

const HistoryPagination: React.FC<HistoryPaginationProps> = ({ page, meta, noun, pluralNoun, loading, onPage }) => {
  if (meta.total === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{meta.from}</span>–
        <span className="font-medium text-slate-700">{meta.to}</span> of{" "}
        <span className="font-medium text-slate-700">{meta.total}</span>{" "}
        {meta.total === 1 ? noun : pluralNoun ?? `${noun}s`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1 || loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        <span className="text-sm text-slate-600 px-2">
          Page {page} of {meta.lastPage}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= meta.lastPage || loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default HistoryPagination;
