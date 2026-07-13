import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { manageRequestAPI } from '../../../../library/manage-request';
import type { User } from '../../../../library/api';
import type { ManageRequest, ManageRequestFilters } from '../../../../library/manage-request';

// TYPE DEFINITIONS
type RecordStatusFilter = 'all' | 'approved' | 'done' | 'cancelled';
type ServiceFilterType = 'all' | 'baptism' | 'service' | 'certificate';

// Extend the ChurchService type to include service_type
interface ExtendedChurchService {
  service_id: number;
  service_name?: string;
  service_type?: string;
  fee?: number;
  form_type?: string | null;
}

// Extend ManageRequest to use ExtendedChurchService
interface ExtendedManageRequest extends Omit<ManageRequest, 'service'> {
  service?: ExtendedChurchService | null;
}

// Modal state types
interface AlertModalState {
  isOpen: boolean;
  title?: string;
  message: string;
  variant?: 'success' | 'error' | 'info' | 'warning';
}

// View Details Modal State
interface ViewDetailsModalState {
  isOpen: boolean;
  request: ExtendedManageRequest | null;
}

const ServiceRecords: React.FC = () => {
  const [requests, setRequests] = useState<ExtendedManageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<RecordStatusFilter>('all');
  const [serviceFilter, setServiceFilter] = useState<ServiceFilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // View Details Modal
  const [viewModal, setViewModal] = useState<ViewDetailsModalState>({
    isOpen: false,
    request: null,
  });

  // Alert Modal
  const [alertModal, setAlertModal] = useState<AlertModalState>({
    isOpen: false,
    message: '',
  });

  // Date range filters
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Define fetchRequests with useCallback
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: ManageRequestFilters & { page?: number } = {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        form_type: serviceFilter !== 'all' ? serviceFilter : undefined,
        per_page: 10,
        page: currentPage,
      };

      // Add date filters if provided
      if (dateFrom) {
        filters.date_from = dateFrom;
      }
      if (dateTo) {
        filters.date_to = dateTo;
      }

      const response = await manageRequestAPI.getAll(filters);

      if (response.data?.success) {
        const responseData = response.data.data;
        
        if (responseData && typeof responseData === 'object') {
          if ('data' in responseData && Array.isArray(responseData.data)) {
            setRequests(responseData.data as ExtendedManageRequest[]);
            setTotalPages(responseData.last_page || 1);
          } else if (Array.isArray(responseData)) {
            setRequests(responseData as ExtendedManageRequest[]);
            setTotalPages(1);
          } else {
            setRequests([]);
            setTotalPages(1);
          }
        } else {
          setRequests([]);
          setTotalPages(1);
        }
      } else {
        setRequests([]);
        setTotalPages(1);
        console.error('API returned unsuccessful:', response.data);
      }
    } catch (err: unknown) {
      console.error('Error fetching requests:', err);
      setError('Failed to load service records. Please try again.');

      let errorMessage = 'Failed to load service records.';
      if (axios.isAxiosError(err)) {
        console.error('API Error Details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });
        errorMessage = err.response?.data?.message || 'Failed to load service records.';
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setAlertModal({
        isOpen: true,
        message: errorMessage,
        variant: 'error',
      });

      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, serviceFilter, currentPage, dateFrom, dateTo]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const getServiceName = (request: ExtendedManageRequest): string | undefined => {
    return request.service?.service_type || request.service?.service_name;
  };

  const getServiceIcon = (request: ExtendedManageRequest): string => {
    const serviceName = getServiceName(request);
    
    if (serviceName) {
      const serviceNameLower = serviceName.toLowerCase();
      if (serviceNameLower.includes('baptism')) return '✝️';
      if (serviceNameLower.includes('marriage')) return '💍';
      if (serviceNameLower.includes('funeral')) return '⚰️';
      if (serviceNameLower.includes('house blessing') || serviceNameLower.includes('blessing')) return '🏠';
      if (serviceNameLower.includes('certificate')) return '📜';
    }
    
    switch (request.form_type) {
      case 'baptism': return '✝️';
      case 'service': return '⚰️';
      case 'certificate': return '📜';
      default: return '📋';
    }
  };

  const getServiceLabel = (request: ExtendedManageRequest): string => {
    const serviceName = getServiceName(request);
    
    if (serviceName) {
      return serviceName;
    }
    
    switch (request.form_type) {
      case 'baptism': return 'Baptism';
      case 'service': return 'Church Service';
      case 'certificate': return 'Certificate';
      default: return 'Unknown';
    }
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-emerald-100 text-emerald-700',
      done: 'bg-blue-100 text-blue-700',
      cancelled: 'bg-rose-100 text-rose-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getPaymentStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      unpaid: 'bg-red-100 text-red-700',
      partial: 'bg-amber-100 text-amber-700',
      paid: 'bg-green-100 text-green-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const handleStatusFilter = (filter: RecordStatusFilter) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  const handleServiceFilter = (filter: ServiceFilterType) => {
    setServiceFilter(filter);
    setCurrentPage(1);
  };

  const getUserFullName = (user: User | undefined | null): string => {
    if (!user) return 'N/A';
    if (user.full_name) return user.full_name;
    if (user.first_name) {
      const middle = user.middle_name ? ` ${user.middle_name}` : '';
      return `${user.first_name}${middle} ${user.last_name}`;
    }
    return 'N/A';
  };

  const formatDateOnly = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatTimeDisplay12Hour = (time: string | undefined): string => {
    if (!time) return 'N/A';
    
    const timeMatch = time.match(/(\d{2}):(\d{2})/);
    if (!timeMatch) {
      return time;
    }
    
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    
    if (isNaN(hours) || isNaN(minutes)) {
      return time;
    }
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDateTime = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusBadgeIcon = (status: string): string => {
    switch (status) {
      case 'approved': return '✅';
      case 'done': return '✔️';
      case 'cancelled': return '❌';
      default: return '';
    }
  };

  // Count statistics
  const getRequestCounts = () => {
    const total = requests.length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const done = requests.filter(r => r.status === 'done').length;
    const cancelled = requests.filter(r => r.status === 'cancelled').length;
    return { total, approved, done, cancelled };
  };

  const counts = getRequestCounts();

  // Open View Details Modal
  const openViewModal = (request: ExtendedManageRequest) => {
    setViewModal({
      isOpen: true,
      request,
    });
  };

  // Close View Details Modal
  const closeViewModal = () => {
    setViewModal({
      isOpen: false,
      request: null,
    });
  };

  // Clear date filters
  const clearDateFilters = () => {
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading service records...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button 
            onClick={() => fetchRequests()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Service Records</h2>
        <p className="text-gray-500">View and manage approved, completed, and cancelled requests</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Records</p>
              <p className="text-2xl font-bold text-gray-800">{counts.total}</p>
            </div>
            <span className="text-3xl">📊</span>
          </div>
        </div>
        <div className="bg-emerald-50 rounded-xl shadow-sm border border-emerald-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-600">Approved</p>
              <p className="text-2xl font-bold text-emerald-700">{counts.approved}</p>
            </div>
            <span className="text-3xl">✅</span>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Completed</p>
              <p className="text-2xl font-bold text-blue-700">{counts.done}</p>
            </div>
            <span className="text-3xl">✔️</span>
          </div>
        </div>
        <div className="bg-rose-50 rounded-xl shadow-sm border border-rose-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-rose-600">Cancelled</p>
              <p className="text-2xl font-bold text-rose-700">{counts.cancelled}</p>
            </div>
            <span className="text-3xl">❌</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        {/* Service Type Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            ['all', 'All Services'],
            ['baptism', '✝️ Baptism'],
            ['service', '⚰️ Church Service'],
            ['certificate', '📜 Certificate'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => handleServiceFilter(value as ServiceFilterType)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                serviceFilter === value
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Status Filters - Shows approved, done, cancelled */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            ['all', 'All', 'bg-gray-800'],
            ['approved', '✅ Approved', 'bg-emerald-600'],
            ['done', '✔️ Completed', 'bg-blue-600'],
            ['cancelled', '❌ Cancelled', 'bg-rose-600'],
          ].map(([value, label, activeColor]) => (
            <button
              key={value}
              onClick={() => handleStatusFilter(value as RecordStatusFilter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                statusFilter === value
                  ? `${activeColor} text-white shadow-md`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date Range Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={clearDateFilters}
              className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
            >
              Clear Dates
            </button>
          )}
          <button
            onClick={() => setCurrentPage(1)}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl shadow border border-gray-200 bg-white">
        <table className="min-w-full">
          <thead className="bg-gradient-to-r from-blue-600 to-blue-700">
            <tr>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Service</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">User</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Schedule</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Contact</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Status</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Payment</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Submitted</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-5xl mb-3">📭</span>
                    <p className="text-gray-500 font-medium">No service records found</p>
                    <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              requests.map((request, index) => {
                const requestId = request.request_id;
                
                return (
                  <tr 
                    key={`${requestId}-${index}`}
                    className="odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors duration-200"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getServiceIcon(request)}</span>
                        <span className="font-medium text-gray-800">
                          {getServiceLabel(request)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-700 font-medium">
                      {getUserFullName(request.user)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-700 font-medium">
                          {formatDateOnly(request.preferred_date)}
                        </span>
                        <span className="text-gray-500 text-sm">
                          {formatTimeDisplay12Hour(request.preferred_time)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {request.user?.contact_number || 'N/A'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit ${getStatusColor(request.status)}`}>
                        {getStatusBadgeIcon(request.status)}
                        {request.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPaymentStatusColor(request.payment_status)}`}>
                        {request.payment_status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-500 text-sm">
                      {formatDateTime(request.created_at)}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => openViewModal(request)}
                        className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div className="px-4 py-2 text-gray-600 font-medium">
            Page {currentPage} of {totalPages}
          </div>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* View Details Modal */}
      {viewModal.isOpen && viewModal.request && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-800">Request Details</h3>
              <button
                onClick={closeViewModal}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-3">
                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 ${getStatusColor(viewModal.request.status)}`}>
                  {getStatusBadgeIcon(viewModal.request.status)}
                  {viewModal.request.status.toUpperCase()}
                </span>
                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${getPaymentStatusColor(viewModal.request.payment_status)}`}>
                  {viewModal.request.payment_status.toUpperCase()}
                </span>
              </div>

              {/* Service Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Service Type</p>
                <p className="font-medium text-gray-800 flex items-center gap-2">
                  <span className="text-2xl">{getServiceIcon(viewModal.request)}</span>
                  {getServiceLabel(viewModal.request)}
                </p>
              </div>

              {/* User Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">User Information</p>
                <p className="font-medium text-gray-800">{getUserFullName(viewModal.request.user)}</p>
                {viewModal.request.user && (
                  <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                    <p>📧 {viewModal.request.user.email || 'N/A'}</p>
                    <p>📞 {viewModal.request.user.contact_number || 'N/A'}</p>
                    <p>📍 {viewModal.request.user.address || 'N/A'}</p>
                  </div>
                )}
              </div>

              {/* Schedule Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Preferred Date</p>
                  <p className="font-medium text-gray-800">{formatDateOnly(viewModal.request.preferred_date)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Preferred Time</p>
                  <p className="font-medium text-gray-800">{formatTimeDisplay12Hour(viewModal.request.preferred_time)}</p>
                </div>
              </div>

              {/* Payment Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Service Fee</p>
                  <p className="font-medium text-gray-800">
                    ₱{(viewModal.request.service?.fee || 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Amount Paid</p>
                  <p className="font-medium text-green-600">
                    ₱{(viewModal.request.amount_paid || 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Remaining Balance</p>
                  <p className={`font-medium ${viewModal.request.remaining_balance && viewModal.request.remaining_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₱{(viewModal.request.remaining_balance || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Submitted</p>
                  <p className="text-sm text-gray-800">{formatDateTime(viewModal.request.created_at)}</p>
                </div>
                {viewModal.request.approved_at && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Approved</p>
                    <p className="text-sm text-gray-800">{formatDateTime(viewModal.request.approved_at)}</p>
                  </div>
                )}
                {viewModal.request.completed_at && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Completed</p>
                    <p className="text-sm text-gray-800">{formatDateTime(viewModal.request.completed_at)}</p>
                  </div>
                )}
              </div>

              {/* Assigned Priest */}
              {viewModal.request.assignedPriest && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Assigned Priest</p>
                  <p className="font-medium text-gray-800">{getUserFullName(viewModal.request.assignedPriest)}</p>
                </div>
              )}

              {/* Cancellation Reason */}
              {viewModal.request.status === 'cancelled' && viewModal.request.cancelled_reason && (
                <div className="bg-rose-50 p-4 rounded-lg border border-rose-200">
                  <p className="text-sm text-rose-600">Cancellation Reason</p>
                  <p className="text-gray-700">{viewModal.request.cancelled_reason}</p>
                </div>
              )}

              {/* Reschedule Info */}
              {viewModal.request.rescheduled_by && (
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-600">Reschedule Information</p>
                  <p className="text-gray-700">
                    Rescheduled by {getUserFullName(viewModal.request.rescheduledBy)}
                  </p>
                  {viewModal.request.reschedule_reason && (
                    <p className="text-gray-600 text-sm mt-1">Reason: {viewModal.request.reschedule_reason}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end p-4 border-t border-gray-200 sticky bottom-0 bg-white">
              <button
                onClick={closeViewModal}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                {alertModal.title || 'Notification'}
              </h3>
              <button
                onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {alertModal.variant === 'success' && '✅'}
                  {alertModal.variant === 'error' && '❌'}
                  {alertModal.variant === 'warning' && '⚠️'}
                  {alertModal.variant === 'info' && 'ℹ️'}
                </span>
                <p className="text-gray-600">{alertModal.message}</p>
              </div>
            </div>
            <div className="flex justify-end p-4 border-t border-gray-200">
              <button
                onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  alertModal.variant === 'success' 
                    ? 'bg-green-600 hover:bg-green-700'
                    : alertModal.variant === 'error'
                    ? 'bg-red-600 hover:bg-red-700'
                    : alertModal.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceRecords;