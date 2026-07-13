import React from "react";
import type { InventoryItem } from "../../../../../../library/inventory";
import { getCategoryInfo } from "../../components/inventoryCategories";

interface BorrowItemsTableProps {
  items: InventoryItem[];
  loading: boolean;
  onBorrow: (item: InventoryItem) => void;
}

const BorrowItemsTable: React.FC<BorrowItemsTableProps> = ({
  items,
  loading,
  onBorrow,
}) => {
  const borrowableItems = items.filter(
    (item) => item.is_borrowable && item.quantity > 0
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (borrowableItems.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">No borrowable items available</div>
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
              Available Quantity
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
          {borrowableItems.map((item) => {
            const availableQty = item.available_quantity ?? item.quantity;
            const categoryInfo = getCategoryInfo(item.category || '');
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
                  <span className={`px-2 py-1 text-xs rounded-full uppercase ${
                    item.type === "item"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-purple-100 text-purple-800"
                  }`}>
                    {item.type}
                  </span>
                </td>
                <td className="px-20 py-4 text-gray-900">
                  {availableQty}
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                    Available
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onBorrow(item)}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Borrow
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default BorrowItemsTable;