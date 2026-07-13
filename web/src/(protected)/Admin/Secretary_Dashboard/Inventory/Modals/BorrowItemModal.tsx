import React from "react";
import { AlertTriangle } from "lucide-react";
import type {
  InventoryItem,
  BorrowFormData,
} from "../../../../../../library/inventory";

interface BorrowItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  selectedItem: InventoryItem | null;
  borrowData: BorrowFormData;
  setBorrowData: React.Dispatch<React.SetStateAction<BorrowFormData>>;
}

const BorrowItemModal: React.FC<BorrowItemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  selectedItem,
  borrowData,
  setBorrowData,
}) => {
  if (!isOpen || !selectedItem) return null;

  const availableQuantity =
    selectedItem.available_quantity ?? selectedItem.quantity;
  const isExceedingQuantity = borrowData.quantity > availableQuantity;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Borrow Item
                </h2>
                <p className="text-sm text-gray-500">
                  Record who is borrowing this item
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Borrowing:</p>
                <p className="font-semibold text-gray-900 text-lg">
                  {selectedItem.name}
                </p>
                {selectedItem.type && (
                  <p className="text-sm text-gray-500">
                    Type:{" "}
                    {selectedItem.type === "item" ? "Item" : "Consumable"}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Available</p>
                <p className="font-bold text-2xl text-green-600">
                  {availableQuantity}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Borrower Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Enter borrower's full name"
                  value={borrowData.borrower_name}
                  onChange={(e) =>
                    setBorrowData({
                      ...borrowData,
                      borrower_name: e.target.value,
                    })
                  }
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Borrower Phone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </div>
                <input
                  type="tel"
                  placeholder="e.g., 09123456789"
                  value={borrowData.borrower_phone || ""}
                  onChange={(e) =>
                    setBorrowData({
                      ...borrowData,
                      borrower_phone: e.target.value,
                    })
                  }
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Borrow Location <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Where is the item being taken?"
                  value={borrowData.location || ""}
                  onChange={(e) =>
                    setBorrowData({ ...borrowData, location: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Enter the location where the item will be used
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Quantity <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  max={availableQuantity}
                  value={borrowData.quantity}
                  onChange={(e) =>
                    setBorrowData({
                      ...borrowData,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-gray-500">
                  Available:{" "}
                  <span className="font-semibold">{availableQuantity}</span>
                </p>
                {isExceedingQuantity && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Exceeds available quantity
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Expected Return Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split("T")[0]}
                  value={borrowData.expected_return_date}
                  onChange={(e) =>
                    setBorrowData({
                      ...borrowData,
                      expected_return_date: e.target.value,
                    })
                  }
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-200 mt-6 pt-4 -mx-6 px-6 rounded-b-2xl">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isExceedingQuantity}
                className={`flex-1 px-6 py-3 font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                  isExceedingQuantity
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700 focus:ring-4 focus:ring-green-300"
                }`}
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
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                Confirm Borrow
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:ring-4 focus:ring-gray-300 transition-all flex items-center justify-center gap-2"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BorrowItemModal;
