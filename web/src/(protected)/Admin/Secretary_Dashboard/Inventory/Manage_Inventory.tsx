import React, { useState, useEffect, useCallback } from "react";
import { inventoryAPI } from "../../../../../library/inventory";
import {
  borrowRecordsAPI,
  type BorrowRecord,
} from "../../../../../library/borrowRecords";
import type {
  InventoryItem,
  CreateInventoryData,
  BorrowFormData,
} from "../../../../../library/inventory";
import InventoryTabs, { type TabType } from "./components/InventoryTabs";
import InventoryStats from "./components/InventoryStats";
import InventoryFilters from "./components/InventoryFilters";
import type { FilterType, FilterStatus } from "./components/InventoryFilters";
import InventoryTable from "./components/InventoryTable";
import BorrowItemsTable from "./components/BorrowItemsTable";
import BorrowerLogsTable from "./components/BorrowerLogsTable";
import AddItemModal from "./Modals/AddItemModal";
import EditItemModal from "./Modals/EditItemModal";
import BorrowItemModal from "./Modals/BorrowItemModal";
import AlertModal from "./Modals/AlertModal";
import ConfirmationModal from "./Modals/ConfirmationModal";

const Manage_Inventory: React.FC = () => {
  // State management
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [allBorrowRecords, setAllBorrowRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("inventory");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // For Alert
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    type: "success" as "success" | "error",
    title: "",
    message: "",
  });

  //For Confimation
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    onConfirm: () => {},
  });

  // New Item Form states
  const [newItem, setNewItem] = useState<CreateInventoryData>({
    name: "",
    quantity: 0,
    type: "item",
    is_borrowable: false,
  });

  // Borrow Item form state.
  const [borrowData, setBorrowData] = useState<BorrowFormData>({
    borrower_name: "",
    borrower_phone: "",
    quantity: 1,
    expected_return_date: "",
    location: "",
  });

  const [editItem, setEditItem] = useState<Partial<InventoryItem>>({});

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    outOfStock: 0,
    borrowed: 0,
    overdue: 0,
    returned: 0,
  });

  const showAlert = (
    type: "success" | "error",
    message: string,
    title?: string
  ) => {
    setAlertModal({
      isOpen: true,
      type,
      title: title || "",
      message,
    });
  };

  const showConfirm = ({
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
  }: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm,
    });
  };

  // FETCH All Borrow Records 
const fetchAllBorrowRecords = useCallback(async () => {
  try {
    const response = await borrowRecordsAPI.getAll();

    if (response.data && response.data.success) {
      const records = response.data.data || [];
      setAllBorrowRecords(records);
    } else {
      setAllBorrowRecords([]);
    }
  } catch (error) {
    console.error("Error fetching all borrow records:", error);
    setAllBorrowRecords([]);
  }
}, []);

  // FETCH Category
  const fetchCategories = useCallback(async () => {
    try {
      const response = await inventoryAPI.getCategories();
      if (response.data.success) {
        setCategories(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // FETCH Items
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsResponse, statsResponse] = await Promise.all([
        inventoryAPI.getAll({ per_page: 100 }),
        inventoryAPI.getStatistics(),
      ]);

      if (itemsResponse.data.success) {
        setItems(itemsResponse.data.data.data);
      }

      if (statsResponse.data.success) {
        const data = statsResponse.data.data;
        setStats({
          total: data.total_items,
          available: data.available_items,
          outOfStock: data.out_of_stock_items,
          borrowed: data.borrowed_items,
          overdue: data.overdue_items,
          returned: data.returned_items,
        });
      }
    } catch (error) {
      console.error("Error fetching items:", error);
      showAlert("error", "Failed to load inventory items.");
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    fetchItems();
    fetchAllBorrowRecords();
  }, [fetchItems,fetchAllBorrowRecords]);

  // FILTER - Main Inventory View (SHOW ALL ITEMS)
  const mainInventoryItems = items.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || item.type === filterType;
    const matchesCategory =
      filterCategory === "all" || item.category === filterCategory;

    let matchesStatus = true;
    if (filterStatus === "all") {
      matchesStatus = true;
    } else if (filterStatus === "out of stock") {
      matchesStatus = item.quantity <= 0;
    } else if (filterStatus === "available") {
      matchesStatus = item.quantity > 0;
    }

    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  });

  // FILTER - Borrowed List View (Only borrowed and overdue records)
  const filteredBorrowRecords = allBorrowRecords
  .filter((record) => {
    const matchesSearch =
      record.borrower_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.inventory?.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      false;
    return matchesSearch;
  })
  .sort((a, b) => {
    const getPriority = (status: string) => {
      if (status === 'overdue') return 0;
      if (status === 'borrowed') return 1;
      if (status === 'returned') return 2;
      return 3;
    };
    
    const priorityA = getPriority(a.status);
    const priorityB = getPriority(b.status);
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    return new Date(b.borrowed_at).getTime() - new Date(a.borrowed_at).getTime();
  });

  // Determine which items to display
  const displayedItems =
    activeTab === "inventory" ? mainInventoryItems : filteredBorrowRecords;

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await inventoryAPI.create(newItem);
      if (response.data.success) {
        showAlert("success", "Item added successfully!");
        setShowAddModal(false);
        resetNewItemForm();
        fetchItems();
      }
    } catch (error) {
      console.error("Error adding item:", error);
      showAlert("error", "Failed to add item.");
    }
  };

  const handleBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      const response = await inventoryAPI.borrow(
        selectedItem.inventory_id,
        borrowData
      );
      if (response.data.success) {
        showAlert("success", "Item borrowed successfully!");
        setShowBorrowModal(false);
        resetBorrowForm();
        fetchItems();
        fetchAllBorrowRecords();
      }
    } catch (error) {
      console.error("Error borrowing item:", error);
      showAlert("error", "Failed to borrow item.");
    }
  };

  const handleReturn = (inventoryId: number) => {
    showConfirm({
      title: "Return Item",
      message: "Are you sure you want to return this item?",
      confirmText: "Return",
      onConfirm: async () => {
        try {
          const response = await borrowRecordsAPI.returnItem(inventoryId);

          if (response.data.success) {
            showAlert("success", "Item returned successfully!");
            fetchItems();
            fetchAllBorrowRecords();
          }
        } catch (error) {
          console.error("Error returning item:", error);
          showAlert("error", "Failed to return item.");
        }
      },
    });
  };

  const handleDelete = (itemId: number) => {
    showConfirm({
      title: "Delete Item",
      message:
        "Are you sure you want to delete this item? This action cannot be undone.",
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          const response = await inventoryAPI.delete(itemId);

          if (response.data.success) {
            showAlert("success", "Item deleted successfully!");
            fetchItems();
          }
        } catch (error) {
          console.error("Error deleting item:", error);
          showAlert("error", "Failed to delete item.");
        }
      },
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      const response = await inventoryAPI.update(
        selectedItem.inventory_id,
        editItem
      );
      if (response.data.success) {
        showAlert("success", "Item updated successfully!");
        setShowEditModal(false);
        fetchItems();
      }
    } catch (error) {
      console.error("Error updating item:", error);
      showAlert("error", "Failed to update item.");
    }
  };

  const resetNewItemForm = () => {
    setNewItem({
      name: "",
      quantity: 0,
      type: "item",
      is_borrowable: false,
    });
  };

  const resetBorrowForm = () => {
    setBorrowData({
      borrower_name: "",
      borrower_phone: "",
      quantity: 1,
      expected_return_date: "",
      location: "",
    });
    setSelectedItem(null);
  };

  const openBorrowModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setBorrowData({
      borrower_name: "",
      borrower_phone: "",
      quantity: 1,
      expected_return_date: new Date().toISOString().split("T")[0],
      location: "",
    });
    setShowBorrowModal(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditItem({
      name: item.name,
      quantity: item.quantity,
      type: item.type,
      category: item.category || "",
      is_borrowable: item.is_borrowable,
    });
    setShowEditModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Inventory Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your items and consumables
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add New Item
          </button>
        </div>

        {/* Statistics Cards */}
        <InventoryStats stats={stats} />

        {/* View Mode Tabs */}
        <InventoryTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Filters */}
        <InventoryFilters
          activeTab={activeTab}
          searchTerm={searchTerm}
          filterType={filterType}
          filterStatus={filterStatus}
          filterCategory={filterCategory}
          categories={categories}
          onSearchChange={setSearchTerm}
          onFilterTypeChange={setFilterType}
          onFilterStatusChange={setFilterStatus}
          onFilterCategoryChange={setFilterCategory}
        />

        {/* Info Banner */}
        {activeTab === "logs" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm text-blue-800">
                  Showing <strong>{displayedItems.length}</strong> borrowed
                  record{displayedItems.length !== 1 ? "s" : ""}
                  {stats.borrowed > 0 && (
                    <span className="ml-2">
                      • <span className="font-medium">Active:</span>{" "}
                      {stats.borrowed}
                    </span>
                  )}
                  {stats.overdue > 0 && (
                    <span className="ml-2 text-red-600">
                      <span className="font-medium">Overdue:</span>{" "}
                      {stats.overdue}
                    </span>
                  )}
                  {stats.returned > 0 && (
                    <span className="ml-2 text-gray-600">
                      • <span className="font-medium">Returned:</span>{" "}
                      {stats.returned}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {activeTab === "inventory" && (
            <InventoryTable
              items={mainInventoryItems}
              loading={loading}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          )}
          {activeTab === "borrow" && (
            <BorrowItemsTable
              items={mainInventoryItems}
              loading={loading}
              onBorrow={openBorrowModal}
            />
          )}
          {activeTab === "logs" && (
            <BorrowerLogsTable
              records={filteredBorrowRecords}
              loading={loading}
              onReturn={handleReturn}
            />
          )}
        </div>
      </div>

      {/* ADD ITEM MODAL */}
      <AddItemModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetNewItemForm();
        }}
        onSubmit={handleAddItem}
        newItem={newItem}
        setNewItem={setNewItem}
      />

      {/* BORROW MODAL */}
      <BorrowItemModal
        isOpen={showBorrowModal}
        onClose={() => {
          setShowBorrowModal(false);
          resetBorrowForm();
        }}
        onSubmit={handleBorrow}
        selectedItem={selectedItem}
        borrowData={borrowData}
        setBorrowData={setBorrowData}
      />

      {/* EDIT MODAL */}
      <EditItemModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEdit}
        selectedItem={selectedItem}
        editItem={editItem}
        setEditItem={setEditItem}
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() =>
          setAlertModal((prev) => ({
            ...prev,
            isOpen: false,
          }))
        }
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        onCancel={() =>
          setConfirmModal((prev) => ({
            ...prev,
            isOpen: false,
          }))
        }
        onConfirm={() => {
          confirmModal.onConfirm();

          setConfirmModal((prev) => ({
            ...prev,
            isOpen: false,
          }));
        }}
      />
    </div>
  );
};

export default Manage_Inventory;
