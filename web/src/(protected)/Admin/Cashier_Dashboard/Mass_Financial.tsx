import React, { useState } from "react";

interface MassFinancialRecord {
  id: number;
  massType: string;
  massDate: string;
  massTime: string;
  intention: string;
  requestedBy: string;
  amount: number;
  donation?: number;
  paymentStatus: "paid" | "pending" | "partial";
  paymentDate?: string;
  offering?: number;
  otherIncome?: number;
}

// Mock data for mass financial records
const initialMassFinancialRecords: MassFinancialRecord[] = [
  {
    id: 1,
    massType: "Sunday Mass",
    massDate: "2024-03-17",
    massTime: "08:00 AM",
    intention: "For the faithful departed",
    requestedBy: "Parish Council",
    amount: 2000,
    donation: 500,
    paymentStatus: "paid",
    paymentDate: "2024-03-17",
    offering: 3000
  },
  {
    id: 2,
    massType: "Wedding Mass",
    massDate: "2024-03-16",
    massTime: "10:00 AM",
    intention: "Marriage of John & Maria",
    requestedBy: "John Santos",
    amount: 5000,
    donation: 1000,
    paymentStatus: "paid",
    paymentDate: "2024-03-16",
    offering: 2000
  },
  {
    id: 3,
    massType: "Baptism Mass",
    massDate: "2024-03-15",
    massTime: "09:00 AM",
    intention: "Baptism of Baby Miguel",
    requestedBy: "Miguel Reyes",
    amount: 1500,
    donation: 300,
    paymentStatus: "pending",
    paymentDate: undefined,
    offering: 0
  },
  {
    id: 4,
    massType: "Healing Mass",
    massDate: "2024-03-18",
    massTime: "05:00 PM",
    intention: "For the sick",
    requestedBy: "Luzviminda Cruz",
    amount: 1500,
    donation: 200,
    paymentStatus: "partial",
    paymentDate: "2024-03-18",
    offering: 1000
  },
  {
    id: 5,
    massType: "Funeral Mass",
    massDate: "2024-03-19",
    massTime: "02:00 PM",
    intention: "Repose of the soul of Juan Dela Cruz",
    requestedBy: "Dela Cruz Family",
    amount: 3000,
    donation: 500,
    paymentStatus: "pending",
    paymentDate: undefined,
    offering: 0
  },
  {
    id: 6,
    massType: "Thanksgiving Mass",
    massDate: "2024-03-20",
    massTime: "07:00 AM",
    intention: "Thanksgiving for blessings received",
    requestedBy: "Ramos Family",
    amount: 1500,
    donation: 1000,
    paymentStatus: "pending",
    paymentDate: undefined,
    offering: 0
  }
];

const MassFinancial: React.FC = () => {
  const [massFinancialRecords, setMassFinancialRecords] = useState<MassFinancialRecord[]>(initialMassFinancialRecords);
  const [selectedRecord, setSelectedRecord] = useState<MassFinancialRecord | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const paidMasses = massFinancialRecords.filter(r => r.paymentStatus === "paid");
  const pendingPayments = massFinancialRecords.filter(r => r.paymentStatus !== "paid");
  const totalMassRevenue = massFinancialRecords
    .filter(r => r.paymentStatus === "paid")
    .reduce((sum, r) => sum + r.amount + (r.donation || 0) + (r.offering || 0), 0);

  // Filter records based on search and filters
  const filteredRecords = massFinancialRecords.filter(record => {
    const matchesSearch = record.massType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.requestedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.intention.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || record.paymentStatus === filterStatus;
    const matchesType = filterType === "all" || record.massType.toLowerCase().includes(filterType.toLowerCase());
    return matchesSearch && matchesStatus && matchesType;
  });

  const handlePaymentConfirmation = (record: MassFinancialRecord) => {
    setSelectedRecord(record);
    setShowPaymentModal(true);
  };

  const confirmPayment = () => {
    if (selectedRecord) {
      const updatedRecords = massFinancialRecords.map(r =>
        r.id === selectedRecord.id
          ? { ...r, paymentStatus: "paid" as const, paymentDate: new Date().toISOString().split('T')[0] }
          : r
      );
      setMassFinancialRecords(updatedRecords);

      const totalAmount = selectedRecord.amount + (selectedRecord.donation || 0) + (selectedRecord.offering || 0);
      setShowSuccessMessage(`Payment of ₱${totalAmount.toLocaleString()} for ${selectedRecord.massType} has been confirmed!`);
      setTimeout(() => setShowSuccessMessage(""), 3000);
      setShowPaymentModal(false);
      setSelectedRecord(null);
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch(status) {
      case "paid": return "bg-green-100 text-green-800";
      case "partial": return "bg-blue-100 text-blue-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Get unique mass types for filter
  const massTypes = ["all", ...new Set(massFinancialRecords.map(r => r.massType))];

  return (
    <div className="space-y-6">
      {/* Success Message Toast */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-slide-in">
          {showSuccessMessage}
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-800">Confirm Mass Payment</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Mass Type:</p>
                  <p className="font-medium text-gray-800">{selectedRecord.massType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Requested By:</p>
                  <p className="font-medium text-gray-800">{selectedRecord.requestedBy}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date & Time:</p>
                  <p className="font-medium text-gray-800">{selectedRecord.massDate} at {selectedRecord.massTime}</p>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-sm">
                    <span>Mass Fee:</span>
                    <span className="font-medium">₱{selectedRecord.amount.toLocaleString()}</span>
                  </div>
                  {selectedRecord.donation > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span>Donation:</span>
                      <span className="font-medium text-green-600">+ ₱{selectedRecord.donation.toLocaleString()}</span>
                    </div>
                  )}
                  {selectedRecord.offering > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span>Offering:</span>
                      <span className="font-medium text-green-600">+ ₱{selectedRecord.offering.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t">
                    <span>Total Amount:</span>
                    <span className="text-green-600">₱{(selectedRecord.amount + (selectedRecord.donation || 0) + (selectedRecord.offering || 0)).toLocaleString()}</span>
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Please verify that the payment has been received before confirming.
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmPayment}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Masses</p>
              <p className="text-2xl font-bold text-gray-800">{massFinancialRecords.length}</p>
            </div>
            <div className="text-3xl text-blue-500">⛪</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Paid Masses</p>
              <p className="text-2xl font-bold text-green-600">{paidMasses.length}</p>
            </div>
            <div className="text-3xl text-green-500">✓</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Pending Payments</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingPayments.length}</p>
            </div>
            <div className="text-3xl text-yellow-500">⏳</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-blue-600">₱{totalMassRevenue.toLocaleString()}</p>
            </div>
            <div className="text-3xl text-blue-500">📊</div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search by mass type, requester, or intention..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {massTypes.map(type => (
                <option key={type} value={type}>
                  {type === "all" ? "All Mass Types" : type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mass Financial Records Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4 bg-linear-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⛪</span>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                Financial Records per Mass
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Track Collection of all Masses
              </p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mass Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Intention
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requested By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stipend
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Donation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Offering
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {record.massType}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {record.massDate}<br />
                    <span className="text-xs">{record.massTime}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                    <div className="truncate" title={record.intention}>
                      {record.intention}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {record.requestedBy}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    ₱{record.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-green-600">
                    {record.donation ? `₱${record.donation.toLocaleString()}` : "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-purple-600">
                    {record.offering ? `₱${record.offering.toLocaleString()}` : "-"}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    ₱{(record.amount + (record.donation || 0) + (record.offering || 0)).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(record.paymentStatus)}`}>
                      {record.paymentStatus}
                    </span>
                    {record.paymentDate && (
                      <div className="text-xs text-gray-400 mt-1">
                        Paid: {record.paymentDate}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {record.paymentStatus !== "paid" && (
                      <button
                        onClick={() => handlePaymentConfirmation(record)}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
                      >
                        Confirm Payment
                      </button>
                    )}
                    {record.paymentStatus === "paid" && (
                      <span className="text-green-600 text-sm font-medium">✓ Paid</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRecords.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No mass financial records found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MassFinancial;