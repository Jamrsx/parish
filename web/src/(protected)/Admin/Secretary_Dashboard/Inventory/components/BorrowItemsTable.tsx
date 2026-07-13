import React from "react";
import type { InventoryItem } from "../../../../../../library/inventory";

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
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Item Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Available Quantity
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
          {borrowableItems.map((item) => {
            const availableQty = item.available_quantity ?? item.quantity;
            const categoryInfo = getCategoryDisplay(item.category);
            
            return (
              <tr key={item.inventory_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${categoryInfo.color}`}>
                    {categoryInfo.icon} {categoryInfo.label}
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