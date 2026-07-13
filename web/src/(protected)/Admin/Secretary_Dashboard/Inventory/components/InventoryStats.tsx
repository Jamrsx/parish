import React from "react";

interface InventoryStatsProps {
  stats: {
    total: number;
    available: number;
    outOfStock: number;
    borrowed: number;
    overdue: number;
    returned: number;
    category_counts?: Record<string, number>; 
  };
}

const InventoryStats: React.FC<InventoryStatsProps> = ({ stats }) => {
  const getCategoryInfo = (category: string) => {
    const categories: Record<string, { label: string; icon: string; color: string }> = {
      sacristy: { label: 'Sacristy', icon: '🕊️', color: 'bg-purple-100 text-purple-800' },
      church: { label: 'Church', icon: '⛪', color: 'bg-blue-100 text-blue-800' },
      office_supply: { label: 'Office Supply', icon: '📎', color: 'bg-green-100 text-green-800' },
      office_equipment: { label: 'Office Equipment', icon: '💻', color: 'bg-indigo-100 text-indigo-800' },
    };
    return categories[category] || { label: category, icon: '📦', color: 'bg-gray-100 text-gray-800' };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-500">Total Items</div>
        <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-500">Available</div>
        <div className="text-2xl font-bold text-green-600">{stats.available}</div>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-500">Out of Stock</div>
        <div className="text-2xl font-bold text-yellow-600">{stats.outOfStock}</div>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-500">Borrowed</div>
        <div className="text-2xl font-bold text-blue-600">{stats.borrowed}</div>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-500">Overdue</div>
        <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-500">Returned</div>
        <div className="text-2xl font-bold text-gray-600">{stats.returned}</div>
      </div>
      
      {/* Category Counts Row */}
      {stats.category_counts && (
        <div className="col-span-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            {Object.entries(stats.category_counts).map(([category, count]) => {
              const info = getCategoryInfo(category);
              return (
                <div key={category} className="bg-white rounded-lg shadow p-4 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{info.icon}</span>
                    <div>
                      <div className="text-sm text-gray-500">{info.label}</div>
                      <div className={`text-xl font-bold ${info.color.replace('bg-', 'text-').replace('100', '700')}`}>
                        {count}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryStats;