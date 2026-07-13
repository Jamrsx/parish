import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { manageRequestAPI } from '../../../../library/manage-request';
import { api } from '../../../../library/api';
import type { User } from '../../../../library/api';
import type { ManageRequest, ManageRequestFilters, RescheduleData } from '../../../../library/manage-request';
import { FileArchive, BarChart3, CheckCircle, CircleCheck, Ban, Church, CheckCircle2, AlertTriangle, Info, XCircle, Clock, Mail, Phone, MapPin, RefreshCw } from 'lucide-react';
import PageHeader from './components/PageHeader';
import SecretaryStatCard from './components/SecretaryStatCard';
import FilterPill from './components/FilterPill';
import EmptyState from './components/EmptyState';
import ModalCloseButton from './components/ModalCloseButton';
import StatusBadge from './components/StatusBadge';
import RequestFormDetails from './components/RequestFormDetails';
import { ServiceTypeIcon, getFilterServiceIcon } from './components/ServiceTypeIcon';

// TYPE DEFINITIONS
type RecordStatusFilter = 'all' | 'pending' | 'approved' | 'done' | 'cancelled';
type ServiceFilterType = 'all' | 'baptism' | 'service' | 'certificate';

const RECORD_STATUS_VALUES: RecordStatusFilter[] = ['all', 'pending', 'approved', 'done', 'cancelled'];
const SERVICE_FILTER_VALUES: ServiceFilterType[] = ['all', 'baptism', 'service', 'certificate'];

const parseStatusFilter = (value: string | null): RecordStatusFilter =>
  RECORD_STATUS_VALUES.includes(value as RecordStatusFilter)
    ? (value as RecordStatusFilter)
    : 'all';

const parseServiceFilter = (value: string | null): ServiceFilterType =>
  SERVICE_FILTER_VALUES.includes(value as ServiceFilterType)
    ? (value as ServiceFilterType)
    : 'all';

const parsePage = (value: string | null): number => {
  const page = Number.parseInt(value || '1', 10);
  return Number.isFinite(page) && page >= 1 ? page : 1;
};

const timeOptions = [
  { label: '8:00 AM', value: '08:00' },
  { label: '9:00 AM', value: '09:00' },
  { label: '10:00 AM', value: '10:00' },
  { label: '11:00 AM', value: '11:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '1:00 PM', value: '13:00' },
  { label: '2:00 PM', value: '14:00' },
  { label: '3:00 PM', value: '15:00' },
  { label: '4:00 PM', value: '16:00' },
  { label: '5:00 PM', value: '17:00' },
];

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
  loading: boolean;
}

interface ConfirmModalState {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  variant?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
}

interface DeclineModalState {
  isOpen: boolean;
  request: ExtendedManageRequest | null;
  reason: string;
}

interface PriestAssignmentModalState {
  isOpen: boolean;
  request: ExtendedManageRequest | null;
  selectedPriestId: number | null;
  priests: User[];
  loading: boolean;
}

const ServiceRecords: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = parseStatusFilter(searchParams.get('status'));
  const serviceFilter = parseServiceFilter(searchParams.get('service'));
  const currentPage = parsePage(searchParams.get('page'));
  const dateFrom = searchParams.get('date_from') || '';
  const dateTo = searchParams.get('date_to') || '';

  const updateSearchParams = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);

          Object.entries(updates).forEach(([key, value]) => {
            if (
              value === null ||
              value === undefined ||
              value === '' ||
              (key === 'page' && value === 1) ||
              (key === 'status' && value === 'all') ||
              (key === 'service' && value === 'all')
            ) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          });

          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const [requests, setRequests] = useState<ExtendedManageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);

  // View Details Modal
  const [viewModal, setViewModal] = useState<ViewDetailsModalState>({
    isOpen: false,
    request: null,
    loading: false,
  });

  const [updating, setUpdating] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
  });
  const [declineModal, setDeclineModal] = useState<DeclineModalState>({
    isOpen: false,
    request: null,
    reason: '',
  });
  const [priestModal, setPriestModal] = useState<PriestAssignmentModalState>({
    isOpen: false,
    request: null,
    selectedPriestId: null,
    priests: [],
    loading: false,
  });
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ExtendedManageRequest | null>(null);
  const [rescheduleData, setRescheduleData] = useState<RescheduleData>({
    preferred_date: '',
    preferred_time: '',
    reschedule_reason: '',
  });
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  // Alert Modal
  const [alertModal, setAlertModal] = useState<AlertModalState>({
    isOpen: false,
    message: '',
  });

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

  const getPaymentStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      unpaid: 'bg-red-100 text-red-700',
      partial: 'bg-amber-100 text-amber-700',
      paid: 'bg-green-100 text-green-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const handleStatusFilter = (filter: RecordStatusFilter) => {
    console.log('Service records status filter:', filter);
    updateSearchParams({ status: filter, page: 1 });
  };

  const handleServiceFilter = (filter: ServiceFilterType) => {
    console.log('Service records service filter:', filter);
    updateSearchParams({ service: filter, page: 1 });
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

  const getRescheduledByName = (request: ExtendedManageRequest): string => {
    if (request.rescheduledBy) {
      return getUserFullName(request.rescheduledBy);
    }

    const rescheduledBy = request.rescheduled_by as
      | { full_name?: string; first_name?: string; last_name?: string }
      | number
      | null
      | undefined;

    if (rescheduledBy && typeof rescheduledBy === 'object') {
      if (rescheduledBy.full_name) return rescheduledBy.full_name;
      if (rescheduledBy.first_name) {
        return `${rescheduledBy.first_name} ${rescheduledBy.last_name || ''}`.trim();
      }
    }

    return request.reschedule_reason ? 'Secretary' : 'N/A';
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

  // Count statistics
  const getRequestCounts = () => {
    const total = requests.length;
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const done = requests.filter(r => r.status === 'done').length;
    const cancelled = requests.filter(r => r.status === 'cancelled').length;
    return { total, pending, approved, done, cancelled };
  };

  const counts = getRequestCounts();

  // Open View Details Modal
  const openViewModal = async (request: ExtendedManageRequest) => {
    console.log('Opening service record details:', request.request_id);
    setViewModal({
      isOpen: true,
      request,
      loading: true,
    });

    try {
      const response = await manageRequestAPI.getById(request.request_id);
      if (response.data?.success && response.data.data) {
        console.log('Service record details loaded:', response.data.data);
        setViewModal({
          isOpen: true,
          request: response.data.data as ExtendedManageRequest,
          loading: false,
        });
      } else {
        setViewModal({
          isOpen: true,
          request,
          loading: false,
        });
      }
    } catch (err) {
      console.error('Error fetching service record details:', err);
      setViewModal({
        isOpen: true,
        request,
        loading: false,
      });
    }
  };

  // Close View Details Modal
  const closeViewModal = () => {
    setViewModal({
      isOpen: false,
      request: null,
      loading: false,
    });
  };

  // Clear date filters
  const clearDateFilters = () => {
    updateSearchParams({ date_from: null, date_to: null, page: 1 });
  };

  const handleDateFromChange = (value: string) => {
    updateSearchParams({ date_from: value || null, page: 1 });
  };

  const handleDateToChange = (value: string) => {
    updateSearchParams({ date_to: value || null, page: 1 });
  };

  const handlePageChange = (page: number) => {
    console.log('Service records page:', page);
    updateSearchParams({ page });
  };

  const handleError = (err: unknown) => {
    console.error('Service records action error:', err);
    let errorMessage = 'An error occurred';
    if (axios.isAxiosError(err)) {
      errorMessage = err.response?.data?.message || errorMessage;
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }
    setAlertModal({
      isOpen: true,
      message: errorMessage,
      variant: 'error',
    });
  };

  const fetchPriests = useCallback(async (): Promise<User[]> => {
    try {
      const response = await api.get('/admin/users', {
        params: { role: 'priest', per_page: 100 },
      });
      if (response.data?.success) {
        const responseData = response.data.data;
        if (responseData && typeof responseData === 'object') {
          if ('data' in responseData && Array.isArray(responseData.data)) {
            return responseData.data;
          }
          if (Array.isArray(responseData)) {
            return responseData;
          }
        }
      }
      return [];
    } catch (error) {
      console.error('Error fetching priests:', error);
      return [];
    }
  }, []);

  const refreshAfterAction = async (requestId?: number) => {
    await fetchRequests();
    if (requestId && viewModal.isOpen && viewModal.request?.request_id === requestId) {
      try {
        const response = await manageRequestAPI.getById(requestId);
        if (response.data?.success && response.data.data) {
          setViewModal({
            isOpen: true,
            request: response.data.data as ExtendedManageRequest,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Failed to refresh view modal:', error);
      }
    }
  };

  const openPriestAssignmentModal = async (request: ExtendedManageRequest) => {
    setPriestModal({
      isOpen: true,
      request,
      selectedPriestId: request.assigned_priest || null,
      priests: [],
      loading: true,
    });
    const priests = await fetchPriests();
    setPriestModal((prev) => ({ ...prev, priests, loading: false }));
  };

  const closePriestAssignmentModal = () => {
    setPriestModal({
      isOpen: false,
      request: null,
      selectedPriestId: null,
      priests: [],
      loading: false,
    });
  };

  const handleAccept = (request: ExtendedManageRequest) => {
    if (request.status !== 'pending') return;

    if (request.assigned_priest) {
      setConfirmModal({
        isOpen: true,
        title: 'Confirm Approval',
        message: 'This request already has an assigned priest. Proceed with approval?',
        variant: 'warning',
        confirmText: 'Yes, Approve',
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          setUpdating(request.request_id);
          try {
            await manageRequestAPI.approve(request.request_id);
            setAlertModal({
              isOpen: true,
              message: 'Request approved successfully!',
              variant: 'success',
            });
            await refreshAfterAction(request.request_id);
          } catch (err) {
            handleError(err);
          } finally {
            setUpdating(null);
          }
        },
      });
      return;
    }

    openPriestAssignmentModal(request);
  };

  const handlePriestAssignment = async () => {
    const { request, selectedPriestId } = priestModal;
    if (!request || !selectedPriestId) {
      setAlertModal({
        isOpen: true,
        message: 'Please select a priest to assign.',
        variant: 'warning',
      });
      return;
    }

    setUpdating(request.request_id);
    try {
      await manageRequestAPI.assignPriest(request.request_id, selectedPriestId);
      await manageRequestAPI.approve(request.request_id);
      setAlertModal({
        isOpen: true,
        message: 'Request approved and priest assigned successfully!',
        variant: 'success',
      });
      closePriestAssignmentModal();
      await refreshAfterAction(request.request_id);
    } catch (err) {
      handleError(err);
    } finally {
      setUpdating(null);
    }
  };

  const openDeclineModal = (request: ExtendedManageRequest) => {
    setDeclineModal({
      isOpen: true,
      request,
      reason: '',
    });
  };

  const closeDeclineModal = () => {
    setDeclineModal({
      isOpen: false,
      request: null,
      reason: '',
    });
  };

  const handleDecline = async () => {
    if (!declineModal.request) return;

    const reason = declineModal.reason.trim();
    if (reason.length < 10) {
      setAlertModal({
        isOpen: true,
        message: 'Please provide a cancellation reason (at least 10 characters).',
        variant: 'warning',
      });
      return;
    }

    const requestId = declineModal.request.request_id;
    setUpdating(requestId);
    try {
      await manageRequestAPI.cancel(requestId, { cancelled_reason: reason });
      setAlertModal({
        isOpen: true,
        message: 'Request declined and cancelled successfully.',
        variant: 'success',
      });
      closeDeclineModal();
      await refreshAfterAction(requestId);
    } catch (err) {
      handleError(err);
    } finally {
      setUpdating(null);
    }
  };

  const openRescheduleModal = (request: ExtendedManageRequest) => {
    let timeValue = request.preferred_time || '';
    const timeMatch = timeValue.match(/(\d{2}):(\d{2})/);
    if (timeMatch) {
      timeValue = timeMatch[0];
    }

    setSelectedRequest(request);
    setRescheduleData({
      preferred_date: request.preferred_date || '',
      preferred_time: timeValue,
      reschedule_reason: '',
    });
    setShowRescheduleModal(true);
  };

  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setSelectedRequest(null);
    setRescheduleData({
      preferred_date: '',
      preferred_time: '',
      reschedule_reason: '',
    });
  };

  const handleReschedule = async () => {
    if (!selectedRequest) return;

    if (!rescheduleData.preferred_date || !rescheduleData.preferred_time) {
      setAlertModal({
        isOpen: true,
        message: 'Please select a new date and time.',
        variant: 'warning',
      });
      return;
    }

    if (!rescheduleData.reschedule_reason || rescheduleData.reschedule_reason.trim().length < 10) {
      setAlertModal({
        isOpen: true,
        message: 'Please provide a reschedule reason (at least 10 characters).',
        variant: 'warning',
      });
      return;
    }

    setRescheduleSubmitting(true);
    try {
      await manageRequestAPI.reschedule(selectedRequest.request_id, rescheduleData);
      setAlertModal({
        isOpen: true,
        message: 'Request rescheduled successfully!',
        variant: 'success',
      });
      closeRescheduleModal();
      await refreshAfterAction(selectedRequest.request_id);
    } catch (err) {
      handleError(err);
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const canAccept = (request: ExtendedManageRequest) => request.status === 'pending';
  const canDecline = (request: ExtendedManageRequest) =>
    request.status === 'pending' || request.status === 'approved';
  const canReschedule = (request: ExtendedManageRequest) =>
    request.can_be_rescheduled ?? (request.status === 'pending' || request.status === 'approved');

  const renderActionButtons = (request: ExtendedManageRequest, compact = false) => (
    <div className={`flex ${compact ? 'flex-col' : 'flex-wrap'} gap-2`}>
      <button
        onClick={() => openViewModal(request)}
        className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
      >
        View Details
      </button>
      {canAccept(request) && (
        <button
          onClick={() => handleAccept(request)}
          disabled={updating === request.request_id}
          className="px-3 py-1.5 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-50"
        >
          Accept
        </button>
      )}
      {canDecline(request) && (
        <button
          onClick={() => openDeclineModal(request)}
          disabled={updating === request.request_id}
          className="px-3 py-1.5 text-sm bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors disabled:opacity-50"
        >
          Decline
        </button>
      )}
      {canReschedule(request) && (
        <button
          onClick={() => openRescheduleModal(request)}
          disabled={updating === request.request_id}
          className="px-3 py-1.5 text-sm bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <RefreshCw size={14} />
          Reschedule
        </button>
      )}
    </div>
  );

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
    <div>
      <PageHeader
        icon={FileArchive}
        title="Service Records"
        description="View and manage pending, approved, completed, and cancelled requests."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <SecretaryStatCard label="Total Records" value={counts.total} icon={BarChart3} />
        <SecretaryStatCard label="Pending" value={counts.pending} icon={Clock} />
        <SecretaryStatCard label="Approved" value={counts.approved} icon={CheckCircle} />
        <SecretaryStatCard label="Completed" value={counts.done} icon={CircleCheck} />
        <SecretaryStatCard label="Cancelled" value={counts.cancelled} icon={Ban} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Service Type</p>
          <div className="flex flex-wrap gap-2">
            {([
              ['all', 'All Services'],
              ['baptism', 'Baptism'],
              ['service', 'Church Service'],
              ['certificate', 'Certificate'],
            ] as const).map(([value, label]) => (
              <FilterPill
                key={value}
                label={label}
                active={serviceFilter === value}
                onClick={() => handleServiceFilter(value)}
                icon={value === 'all' ? Church : getFilterServiceIcon(value)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Status</p>
          <div className="flex flex-wrap gap-2">
            {([
              ['all', 'All'],
              ['pending', 'Pending'],
              ['approved', 'Approved'],
              ['done', 'Completed'],
              ['cancelled', 'Cancelled'],
            ] as const).map(([value, label]) => (
              <FilterPill
                key={value}
                label={label}
                active={statusFilter === value}
                onClick={() => handleStatusFilter(value)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={clearDateFilters}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm"
            >
              Clear Dates
            </button>
          )}
          <button
            onClick={() => handlePageChange(1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium"
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
                <td colSpan={8}>
                  <EmptyState
                    title="No service records found"
                    description="Try adjusting your filters."
                  />
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
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                          <ServiceTypeIcon
                            serviceName={getServiceName(request)}
                            formType={request.form_type}
                            size={18}
                          />
                        </div>
                        <span className="font-medium text-slate-800">
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
                      <StatusBadge status={request.status} label={request.status.toUpperCase()} />
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
                      {renderActionButtons(request)}
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
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div className="px-4 py-2 text-gray-600 font-medium">
            Page {currentPage} of {totalPages}
          </div>
          <button
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* View Details Modal */}
      {viewModal.isOpen && viewModal.request && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-slate-800">Request Details</h3>
              <ModalCloseButton onClick={closeViewModal} />
            </div>
            
            <div className="p-6 space-y-4">
              {viewModal.loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                  <p className="text-slate-500 mt-4">Loading request details...</p>
                </div>
              ) : (
                <>
              {/* Status Badge */}
              <div className="flex items-center gap-3">
                <StatusBadge status={viewModal.request.status} label={viewModal.request.status.toUpperCase()} />
                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${getPaymentStatusColor(viewModal.request.payment_status)}`}>
                  {viewModal.request.payment_status.toUpperCase()}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-500">Request ID</p>
                <p className="font-semibold text-slate-800">#{viewModal.request.request_id}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-500">Service Type</p>
                <p className="font-medium text-slate-800 flex items-center gap-2">
                  <ServiceTypeIcon
                    serviceName={getServiceName(viewModal.request)}
                    formType={viewModal.request.form_type}
                    size={20}
                  />
                  {getServiceLabel(viewModal.request)}
                </p>
              </div>

              {/* Event / Form Details */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <RequestFormDetails request={viewModal.request} formatDateOnly={formatDateOnly} />
              </div>

              {/* User Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-2">Submitted By</p>
                <p className="font-medium text-gray-800">{getUserFullName(viewModal.request.user)}</p>
                {viewModal.request.user && (
                  <div className="text-sm text-gray-600 mt-2 space-y-1.5">
                    <p className="flex items-center gap-2">
                      <Mail size={14} className="text-slate-400" />
                      {viewModal.request.user.email || 'N/A'}
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone size={14} className="text-slate-400" />
                      {viewModal.request.user.contact_number || 'N/A'}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin size={14} className="text-slate-400" />
                      {viewModal.request.user.address || 'N/A'}
                    </p>
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
              {(viewModal.request.reschedule_reason || viewModal.request.rescheduled_by) && (
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-600">Reschedule Information</p>
                  <p className="text-gray-700">
                    Rescheduled by {getRescheduledByName(viewModal.request)}
                  </p>
                  {viewModal.request.reschedule_reason && (
                    <p className="text-gray-600 text-sm mt-1">Reason: {viewModal.request.reschedule_reason}</p>
                  )}
                </div>
              )}
                </>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 p-4 border-t border-gray-200 sticky bottom-0 bg-white">
              {viewModal.request && !viewModal.loading && renderActionButtons(viewModal.request, true)}
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

      {/* Decline Modal */}
      {declineModal.isOpen && declineModal.request && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Decline Request</h3>
              <ModalCloseButton onClick={closeDeclineModal} />
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-600">
                Please provide a reason for declining this request. The parishioner will be notified.
              </p>
              <textarea
                value={declineModal.reason}
                onChange={(e) => setDeclineModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Enter cancellation reason..."
                rows={4}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              />
              <p className="text-xs text-slate-400">Minimum 10 characters</p>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={closeDeclineModal}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={updating === declineModal.request.request_id}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {updating === declineModal.request.request_id ? 'Processing...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800">Reschedule Request</h3>
              <ModalCloseButton onClick={closeRescheduleModal} />
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">User</label>
                <p className="text-slate-600">{getUserFullName(selectedRequest.user)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Service</label>
                <p className="text-slate-600">{getServiceLabel(selectedRequest)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Preferred Date *</label>
                <input
                  type="date"
                  value={rescheduleData.preferred_date}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, preferred_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Preferred Time *</label>
                <select
                  value={rescheduleData.preferred_time}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, preferred_time: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="">Select time</option>
                  {timeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reschedule Reason *</label>
                <textarea
                  value={rescheduleData.reschedule_reason}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, reschedule_reason: e.target.value })}
                  placeholder="Explain why this request is being rescheduled..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">Minimum 10 characters. Conflicts with pending or approved schedules are blocked.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={closeRescheduleModal}
                disabled={rescheduleSubmitting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={rescheduleSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50"
              >
                {rescheduleSubmitting ? 'Processing...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Priest Assignment Modal */}
      {priestModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Assign Priest &amp; Accept</h3>
              <ModalCloseButton onClick={closePriestAssignmentModal} />
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg space-y-1 text-sm">
                <p><span className="font-medium">User:</span> {priestModal.request ? getUserFullName(priestModal.request.user) : 'N/A'}</p>
                <p><span className="font-medium">Service:</span> {priestModal.request ? getServiceLabel(priestModal.request) : 'N/A'}</p>
                <p><span className="font-medium">Date:</span> {priestModal.request ? formatDateOnly(priestModal.request.preferred_date) : 'N/A'}</p>
                <p><span className="font-medium">Time:</span> {priestModal.request ? formatTimeDisplay12Hour(priestModal.request.preferred_time) : 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Priest *</label>
                {priestModal.loading ? (
                  <div className="flex items-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    <span className="ml-2 text-sm text-slate-500">Loading priests...</span>
                  </div>
                ) : (
                  <select
                    value={priestModal.selectedPriestId || ''}
                    onChange={(e) =>
                      setPriestModal((prev) => ({
                        ...prev,
                        selectedPriestId: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  >
                    <option value="">Select a priest...</option>
                    {priestModal.priests.map((priest) => (
                      <option key={priest.user_id} value={priest.user_id}>
                        {getUserFullName(priest)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={closePriestAssignmentModal}
                disabled={priestModal.loading}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handlePriestAssignment}
                disabled={priestModal.loading || !priestModal.selectedPriestId}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
              >
                Assign &amp; Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">{confirmModal.title || 'Confirm Action'}</h3>
              <ModalCloseButton onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))} />
            </div>
            <div className="p-4">
              <p className="text-slate-600">{confirmModal.message}</p>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                {confirmModal.cancelText || 'Cancel'}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">
                {alertModal.title || 'Notification'}
              </h3>
              <ModalCloseButton onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))} />
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <span className={`flex-shrink-0 p-2 rounded-full ${
                  alertModal.variant === 'success' ? 'bg-emerald-100 text-emerald-600' :
                  alertModal.variant === 'error' ? 'bg-rose-100 text-rose-600' :
                  alertModal.variant === 'warning' ? 'bg-amber-100 text-amber-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {alertModal.variant === 'success' && <CheckCircle2 size={24} />}
                  {alertModal.variant === 'error' && <XCircle size={24} />}
                  {alertModal.variant === 'warning' && <AlertTriangle size={24} />}
                  {alertModal.variant === 'info' && <Info size={24} />}
                </span>
                <p className="text-slate-600">{alertModal.message}</p>
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