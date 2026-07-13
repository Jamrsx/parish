import React from "react";
import type { InventoryItem } from "../../../../../../library/inventory";
import { getCategoryInfo } from "../../components/inventoryCategories";

interface InventoryTableProps {
  items: InventoryItem[];
  loading: boolean;
  onEdit: (item: InventoryItem) => void;
  onDelete: (itemId: number) => void;
}

const InventoryTable: React.FC<InventoryTableProps> = ({
  items,
  loading,
  onEdit,
  onDelete,
}) => {
  const getMainInventoryStatus = (item: InventoryItem): string => {
    if (item.quantity <= 0) {
      return 'out of stock';
    }
    return 'available';
  };

const getCategoryDisplay = (category?: string) => getCategoryInfo(category || '');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">No items found</div>
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
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Quantity
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Available
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item) => {
            const displayStatus = getMainInventoryStatus(item);
            const categoryInfo = getCategoryDisplay(item.category);
            const CategoryIcon = categoryInfo.Icon;

            return (
              <tr key={item.inventory_id} className="hover:bg-blue-50/50">
                <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border ${categoryInfo.badgeClass}`}>
                    <CategoryIcon size={12} />
                    {categoryInfo.label}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {item.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-900">
                  {item.quantity}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 text-xs rounded-full border ${
                    displayStatus === "available"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}>
                    {displayStatus}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-900">
                  {item.available_quantity ?? item.quantity}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => onEdit(item)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(item.inventory_id)}
                      className="px-3 py-1.5 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      Delete
                    </button>
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

export default InventoryTable;