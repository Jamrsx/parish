import React from "react";
import type { BorrowRecord } from "../../../../../../library/borrowRecords";
import { getCategoryInfo } from "../../components/inventoryCategories";

interface BorrowerLogsTableProps {
  records: BorrowRecord[];
  loading: boolean;
  onReturn: (record: BorrowRecord) => void;
}

const BorrowerLogsTable: React.FC<BorrowerLogsTableProps> = ({
  records,
  loading,
  onReturn,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">No borrowed records found</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-blue-600">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Item Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Category
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Borrower
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Qty Borrowed
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Damaged
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Location
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Borrowed At
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Expected Return
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200">
          {records.map((record) => {
            const categoryInfo = getCategoryInfo(record.inventory?.category || "");
            const CategoryIcon = categoryInfo.Icon;
            const damaged = Number(record.quantity_damaged || 0);

            return (
              <tr key={record.borrow_record_id} className="hover:bg-blue-50/50">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">
                    {record.inventory?.name || "Unknown Item"}
                  </div>
                </td>

                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border ${categoryInfo.badgeClass}`}
                  >
                    <CategoryIcon size={12} />
                    {categoryInfo.label}
                  </span>
                </td>

                <td className="px-6 py-4">
                  <div className="font-medium">{record.borrower_name}</div>
                  {record.borrower_phone && (
                    <div className="text-xs text-gray-500">{record.borrower_phone}</div>
                  )}
                </td>

                <td className="px-6 py-4 text-gray-900 text-center">
                  {record.quantity_borrowed || 1}
                </td>

                <td className="px-6 py-4 text-center">
                  {record.status === "returned" ? (
                    damaged > 0 ? (
                      <div>
                        <span className="px-2 py-1 text-xs rounded-full bg-rose-100 text-rose-800 font-semibold">
                          {damaged}
                        </span>
                        {record.damage_notes && (
                          <p className="text-xs text-slate-500 mt-1 max-w-[140px] truncate" title={record.damage_notes}>
                            {record.damage_notes}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">0</span>
                    )
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>

                <td className="px-6 py-4 text-gray-900">{record.location || "-"}</td>

                <td className="px-6 py-4 text-gray-900">
                  {new Date(record.borrowed_at).toLocaleDateString()}
                </td>

                <td className="px-6 py-4 text-gray-900">
                  {new Date(record.expected_return_date).toLocaleDateString()}
                </td>

                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      record.status === "borrowed"
                        ? "bg-blue-200 text-blue-800"
                        : record.status === "overdue"
                        ? "bg-red-200 text-red-800"
                        : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    {record.status}
                  </span>
                </td>

                <td className="px-6 py-4">
                  <div className="flex gap-2 flex-wrap">
                    {(record.status === "borrowed" || record.status === "overdue") && (
                      <button
                        onClick={() => onReturn(record)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Return
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default BorrowerLogsTable;
