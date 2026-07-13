import React from "react";
import type { InventoryItem } from "../../../../../../library/inventory";

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
              Quantity
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Available
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item) => {
            const displayStatus = getMainInventoryStatus(item);
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
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.type === "item"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-purple-100 text-purple-800"
                  }`}>
                    {item.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-900">
                  {item.quantity}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    displayStatus === "available"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
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
                      className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(item.inventory_id)}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
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