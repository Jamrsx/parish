import React from "react";
import type { BorrowRecord } from "../../../../../../library/borrowRecords";

interface BorrowerLogsTableProps {
  records: BorrowRecord[];
  loading: boolean;
  onReturn: (inventoryId: number) => void;
}

const BorrowerLogsTable: React.FC<BorrowerLogsTableProps> = ({
  records,
  loading,
  onReturn,
}) => {

  // Helper to get category display
  const getCategoryDisplay = (category?: string) => {
    const categories: Record<string, { label: string; icon: string; color: string }> = {
      sacristy: { label: 'Sacristy Items', icon: '🕊️', color: 'bg-purple-100 text-purple-800' },
      church: { label: 'Church Items', icon: '⛪', color: 'bg-blue-100 text-blue-800' },
      office_supply: { label: 'Office Supply', icon: '📎', color: 'bg-green-100 text-green-800' },
      office_equipment: { label: 'Office Equipment', icon: '💻', color: 'bg-indigo-100 text-indigo-800' },
    };
    
    if (!category || !categories[category]) {
      return { label: 'Uncategorized', icon: '📦', color: 'bg-gray-100 text-gray-800' };
    }
    
    return categories[category];
  };

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
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Item Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Borrower
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Quantity Borrowed
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Location
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Borrowed At
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Expected Return
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200">
           {records.map((record) => {
            const categoryInfo = getCategoryDisplay(record.inventory?.category);
          
          return(
            <tr key={record.borrow_record_id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">
                  {record.inventory?.name || "Unknown Item"}
                </div>
              </td>

              <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${categoryInfo.color}`}>
                    {categoryInfo.icon} {categoryInfo.label}
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

              <td className="px-6 py-4 text-gray-900">{record.location || "-"}</td>

              <td className="px-6 py-4 text-gray-900">
                {new Date(record.borrowed_at).toLocaleDateString()}
              </td>

              <td className="px-6 py-4 text-gray-900 ">
                {new Date(record.expected_return_date).toLocaleDateString()}
                {record.status === "overdue" }
              </td>

              <td className="px-6 py-4">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  record.status === "borrowed"
                    ? "bg-blue-200 text-blue-800"
                    : record.status === "overdue"
                    ? "bg-red-200 text-red-800"
                    : "bg-gray-200 text-gray-800"
                }`}>
                  {record.status}
                </span>
              </td>

              <td className="px-6 py-4">
                <div className="flex gap-2 flex-wrap">
                  {(record.status === "borrowed" || record.status === "overdue") && (
                    <button
                      onClick={() => onReturn(record.inventory_id)}
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