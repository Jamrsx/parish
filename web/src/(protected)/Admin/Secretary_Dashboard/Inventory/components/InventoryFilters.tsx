import React from "react";

export type FilterType = "all" | "item" | "consumable";
export type FilterStatus = "all" | "available" | "out of stock";

interface InventoryFiltersProps {
  activeTab: "inventory" | "borrow" | "logs";
  searchTerm: string;
  filterType: FilterType;
  filterStatus: FilterStatus;
  filterCategory: string;
  categories: string[];
  onSearchChange: (value: string) => void;
  onFilterTypeChange: (value: FilterType) => void;
  onFilterStatusChange: (value: FilterStatus) => void;
  onFilterCategoryChange: (value: string) => void;
}

const formatCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
        sacristy: 'Sacristy Items',
        church: 'Church Items',
        office_supply: 'Office Supply',
        office_equipment: 'Office Equipment'
    };
    return labels[category] || category.replace('_', ' ');
};

const InventoryFilters: React.FC<InventoryFiltersProps> = ({
  activeTab,
  searchTerm,
  filterType,
  filterStatus,
  filterCategory,
  categories,
  onSearchChange,
  onFilterTypeChange,
  onFilterStatusChange,
  onFilterCategoryChange,
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-50">
          <input
            type="text"
            placeholder={
              activeTab === "inventory"
                ? "Search items by name..."
                : "Search by borrower or item..."
            }
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Category Filter */}
        {(activeTab === "inventory" || activeTab === "borrow" ) && categories.length > 0 && (
          <select
            value={filterCategory}
            onChange={(e) => onFilterCategoryChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {formatCategoryLabel(cat)}
              </option>
            ))}
          </select>
        )}

        {/* Type filter on Inventory tab */}
        {activeTab === "inventory" && (
          <select
            value={filterType}
            onChange={(e) => onFilterTypeChange(e.target.value as FilterType)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="item">Items</option>
            <option value="consumable">Consumables</option>
          </select>
        )}

        {/* Status filter on Inventory tab */}
        {activeTab === "inventory" && (
          <select
            value={filterStatus}
            onChange={(e) =>
              onFilterStatusChange(e.target.value as FilterStatus)
            }
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="out of stock">Out of Stock</option>
          </select>
        )}
      </div>
    </div>
  );
};

export default InventoryFilters;