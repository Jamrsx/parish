import React, { useState } from "react";

interface ServiceRequest {
  id: number;
  requesterName: string;
  serviceType: "Baptism" | "HouseBlessings" | "Funeral Mass" | "Marriage Inquiries";
  requestDate: string;
  scheduledDate: string;
  amount: number;
  paymentStatus: "pending" | "paid" | "partial";
  approved: boolean;
  status: "pending" | "approved" | "completed" | "cancelled";
  notes?: string;
}

// Mock data for service requests
const initialServiceRequests: ServiceRequest[] = [
  {
    id: 1,
    requesterName: "John Santos",
    serviceType: "Baptism",
    requestDate: "2024-03-15",
    scheduledDate: "2024-03-25",
    amount: 1500,
    paymentStatus: "paid",
    approved: true,
    status: "approved"
  },
  {
    id: 2,
    requesterName: "Maria Reyes",
    serviceType: "HouseBlessings",
    requestDate: "2024-03-16",
    scheduledDate: "2024-03-28",
    amount: 1000,
    paymentStatus: "pending",
    approved: true,
    status: "approved"
  },
  {
    id: 3,
    requesterName: "Robert Cruz",
    serviceType: "Funeral Mass",
    requestDate: "2024-03-14",
    scheduledDate: "2024-03-20",
    amount: 3000,
    paymentStatus: "partial",
    approved: true,
    status: "approved"
  },
  {
    id: 4,
    requesterName: "Ana Garcia",
    serviceType: "Marriage Inquiries",
    requestDate: "2024-03-17",
    scheduledDate: "2024-04-05",
    amount: 2000,
    paymentStatus: "pending",
    approved: true,
    status: "approved"
  },
  {
    id: 5,
    requesterName: "Carlos Mendoza",
    serviceType: "Baptism",
    requestDate: "2024-03-18",
    scheduledDate: "2024-03-30",
    amount: 1500,
    paymentStatus: "pending",
    approved: true,
    status: "approved"
  }
];

const ManageUnpaidRequest: React.FC = () => {
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>(initialServiceRequests);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [showSuccessMessage, setShowSuccessMessage] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Filter approved requests only
  const approvedRequests = serviceRequests.filter(r => r.approved);
  const paidRequests = approvedRequests.filter(r => r.paymentStatus === "paid");
  const pendingPaymentRequests = approvedRequests.filter(r => r.paymentStatus !== "paid");
  const totalServiceRevenue = approvedRequests
    .filter(r => r.paymentStatus === "paid")
    .reduce((sum, r) => sum + r.amount, 0);

  // Filter requests based on search and status
  const filteredRequests = approvedRequests.filter(request => {
    const matchesSearch = request.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.serviceType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || request.paymentStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handlePaymentConfirmation = (request: ServiceRequest) => {
    setSelectedRequest(request);
    setPaymentAmount(request.amount.toString());
    setShowPaymentModal(true);
  };

  const confirmPayment = () => {
    if (selectedRequest) {
      // Update the service request payment status
      setServiceRequests(prev => prev.map(req => 
        req.id === selectedRequest.id 
          ? { ...req, paymentStatus: "paid", status: "completed" as const }
          : req
      ));

      setShowSuccessMessage(`Payment of ₱${selectedRequest.amount.toLocaleString()} from ${selectedRequest.requesterName} has been confirmed!`);
      setTimeout(() => setShowSuccessMessage(""), 3000);
      setShowPaymentModal(false);
      setSelectedRequest(null);
      setPaymentAmount("");
    }
  };

  const getServiceTypeColor = (type: string) => {
    switch(type) {
      case "Baptism": return "bg-blue-100 text-blue-800";
      case "HouseBlessings": return "bg-green-100 text-green-800";
      case "Funeral Mass": return "bg-gray-100 text-gray-800";
      case "Marriage Inquiries": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
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

  return (
    <div className="space-y-6">
      {/* Success Message Toast */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-slide-in">
          {showSuccessMessage}
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-800">Confirm Payment</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Requester:</p>
                  <p className="font-medium text-gray-800">{selectedRequest.requesterName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Service Type:</p>
                  <p className="font-medium text-gray-800">{selectedRequest.serviceType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Scheduled Date:</p>
                  <p className="font-medium text-gray-800">{selectedRequest.scheduledDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Amount:</p>
                  <p className="text-2xl font-bold text-green-600">₱{selectedRequest.amount.toLocaleString()}</p>
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
              <p className="text-gray-600 text-sm">Approved Requests</p>
              <p className="text-2xl font-bold text-gray-800">{approvedRequests.length}</p>
            </div>
            <div className="text-3xl text-blue-500">✓</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Paid Services</p>
              <p className="text-2xl font-bold text-green-600">{paidRequests.length}</p>
            </div>
            <div className="text-3xl text-green-500">💰</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Pending Payment</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingPaymentRequests.length}</p>
            </div>
            <div className="text-3xl text-yellow-500">⏳</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-blue-600">₱{totalServiceRevenue.toLocaleString()}</p>
            </div>
            <div className="text-3xl text-blue-500">📊</div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or service type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Service Requests Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4 bg-linear-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                Manage Service Requests
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Review and confirm payments for approved service requests
              </p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requester
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Request Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scheduled Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {request.requesterName}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getServiceTypeColor(request.serviceType)}`}>
                      {request.serviceType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {request.requestDate}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {request.scheduledDate}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    ₱{request.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(request.paymentStatus)}`}>
                      {request.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {request.paymentStatus !== "paid" && (
                      <button
                        onClick={() => handlePaymentConfirmation(request)}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
                      >
                        Confirm Payment
                      </button>
                    )}
                    {request.paymentStatus === "paid" && (
                      <span className="text-green-600 text-sm font-medium">✓ Paid</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRequests.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No service requests found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageUnpaidRequest;