import React from "react";
import { Package, Handshake, ScrollText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TabType = "inventory" | "borrow" | "logs";

interface InventoryTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs: { id: TabType; label: string; icon: LucideIcon }[] = [
  { id: "inventory", label: "Main Inventory", icon: Package },
  { id: "borrow", label: "Borrow Items", icon: Handshake },
  { id: "logs", label: "Borrower Logs", icon: ScrollText },
];

const InventoryTabs: React.FC<InventoryTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onTabChange(id)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
            activeTab === id
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          }`}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </div>
  );
};

export default InventoryTabs;
