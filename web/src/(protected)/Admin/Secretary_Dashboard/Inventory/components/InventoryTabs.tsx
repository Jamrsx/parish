import React from "react";

export type TabType = "inventory" | "borrow" | "logs";

interface InventoryTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const InventoryTabs: React.FC<InventoryTabsProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => onTabChange("inventory")}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          activeTab === "inventory"
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-700 hover:bg-gray-100"
        }`}
      >
        📦 Main Inventory
      </button>

      <button
        onClick={() => onTabChange("borrow")}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          activeTab === "borrow"
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-700 hover:bg-gray-100"
        }`}
      >
        🤝 Borrow Items
      </button>

      <button
        onClick={() => onTabChange("logs")}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          activeTab === "logs"
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-700 hover:bg-gray-100"
        }`}
      >
        📜 Borrower Logs
      </button>
    </div>
  );
};

export default InventoryTabs;