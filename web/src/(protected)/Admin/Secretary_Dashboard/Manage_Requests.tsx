import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getStatusLabel, manageRequestAPI } from '../../../../library/manage-request';
import { usersAPI } from '../../../../library/api';
import type { ManageRequest, ManageRequestFilters, RescheduleData } from '../../../../library/manage-request';
import type { User } from '../../../../library/AuthStorage';
import { RefreshCw, Eye, Church, CheckCircle2, AlertTriangle, Info, XCircle, ClipboardList, Users, User as UserIcon } from 'lucide-react';
import PageHeader from './components/PageHeader';
import FilterPill from './components/FilterPill';
import EmptyState from './components/EmptyState';
import ModalCloseButton from './components/ModalCloseButton';
import StatusBadge from './components/StatusBadge';
import ExpiryIndicator, { EXPIRY_WARN_MINUTES, expiryState } from './components/ExpiryIndicator';
import { ServiceTypeIcon, getFilterServiceIcon } from './components/ServiceTypeIcon';
import { getFormattedRequestContactNumber, formatPhilippinePhone, getResidencyLabel, shouldShowNonResidentAddress, getRequestFormAddress, isParishResident } from './components/requestHelpers';
import { useBookedTimeSlots } from './hooks/useBookedTimeSlots';
import ServiceDatePicker from '../../../components/booking/ServiceDatePicker';
import { buildTimeOptions, isLongService, timeProblem } from '../../../components/booking/serviceSlots';
import { SecretaryTableSkeleton } from './components/SecretarySkeletons';
import { priestSlotFor } from '../../../../library/priestSchedule';

// TYPE DEFINITIONS
type ServiceFilterType = 'all' | 'baptism' | 'service' | 'certificate';

// Format time to 12-hour format 
const formatTimeDisplay12Hour = (time: string): string => {
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

// Extend the ChurchService type to include service_type
interface ExtendedChurchService {
  service_id: number;
  service_name?: string;
  service_type?: string;
  fee?: number;
  form_type?: string | null;
  form_handler?: string | null;
}

// Extend ManageRequest to use ExtendedChurchService
interface ExtendedManageRequest extends Omit<ManageRequest, 'service'> {
  service?: ExtendedChurchService | null;
}

// Modal state types
interface ConfirmModalState {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  /** When set, Cancel/No runs this instead of only closing (e.g. approve without priest). */
  onCancel?: () => void;
  variant?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
}

interface PromptModalState {
  isOpen: boolean;
  title?: string;
  message?: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  required?: boolean;
  confirmText?: string;
  cancelText?: string;
}

interface AlertModalState {
  isOpen: boolean;
  title?: string;
  message: string;
  variant?: 'success' | 'error' | 'info' | 'warning';
}

// Priest Assignment Modal State
interface PriestAssignmentModalState {
  isOpen: boolean;
  request: ExtendedManageRequest | null;
  selectedPriestId: number | null;
  priests: User[];
  loading: boolean;
  /** Certificates: priest is optional; services: required before approve */
  priestOptional: boolean;
  /** assign_and_approve = assign then approve; assign_only = save priest, stay pending */
  mode: 'assign_and_approve' | 'assign_only';
}

// Request Details Modal State
interface RequestDetailsModalState {
  isOpen: boolean;
  request: ExtendedManageRequest | null;
  loading: boolean;
}

// Type for a baptism godparent
interface BaptismFormGodparent {
  godparent_name: string;
  relationship: 'godfather' | 'godmother';
}

// Type for godparent from manage-request.ts
interface ManageRequestGodparent {
  name: string;
  type: 'godfather' | 'godmother';
}

// Union type for godparents
type Godparent = BaptismFormGodparent | ManageRequestGodparent;

const ManageRequests: React.FC = () => {
  const [requests, setRequests] = useState<ExtendedManageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [serviceFilter, setServiceFilter] = useState<ServiceFilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updating, setUpdating] = useState<number | null>(null);

  // Reschedule modal state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ExtendedManageRequest | null>(null);
  const [rescheduleData, setRescheduleData] = useState<RescheduleData>({
    preferred_date: '',
    preferred_time: '',
    reschedule_reason: '',
  });
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const { bookedSlots } = useBookedTimeSlots(
    showRescheduleModal ? rescheduleData.preferred_date : '',
    selectedRequest?.request_id
  );
  const rescheduleIsCertificate = !!selectedRequest?.certificate_form_id;
  const rescheduleIsLong = isLongService(selectedRequest?.service?.form_handler);

  // Priest Assignment Modal State
  const [priestModal, setPriestModal] = useState<PriestAssignmentModalState>({
    isOpen: false,
    request: null,
    selectedPriestId: null,
    priests: [],
    loading: false,
    priestOptional: false,
    mode: 'assign_and_approve',
  });

  // Request Details Modal State
  const [detailsModal, setDetailsModal] = useState<RequestDetailsModalState>({
    isOpen: false,
    request: null,
    loading: false,
  });

  // Modal states
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
  });

  const [promptModal, setPromptModal] = useState<PromptModalState>({
    isOpen: false,
    onConfirm: () => {},
  });

  const [alertModal, setAlertModal] = useState<AlertModalState>({
    isOpen: false,
    message: '',
  });

  // Type guards for godparents
  const isBaptismFormGodparent = (gp: Godparent): gp is BaptismFormGodparent => {
    return 'godparent_name' in gp && 'relationship' in gp;
  };

  const isManageRequestGodparent = (gp: Godparent): gp is ManageRequestGodparent => {
    return 'name' in gp && 'type' in gp;
  };

  // Fetch priests function - using the admin/users endpoint with role filter
  // Priests who are off at the given service date/time come back with `availability_problem` and are shown disabled
  const fetchPriests = useCallback(async (slot: { forDate?: string; forTime?: string } = {}): Promise<User[]> => {
    try {
      console.log('Fetching priests for slot:', slot);
      const response = await usersAPI.listPriests({ activeOnly: true, ...slot });
      
      if (response.data?.success) {
        const responseData = response.data.data;
        if (responseData && typeof responseData === 'object') {
          if ('data' in responseData && Array.isArray(responseData.data)) {
            return responseData.data;
          } else if (Array.isArray(responseData)) {
            return responseData;
          }
        }
        return [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching priests:', error);
      return [];
    }
  }, []);

  // Define fetchRequests with useCallback - Always filter for 'pending' status
  // Ticks every 15 s so the expiring-soon banner and row tint stay current
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: ManageRequestFilters & { page?: number } = {
        status: 'pending', // Always filter for pending status
        form_type: serviceFilter !== 'all' ? serviceFilter : undefined,
        per_page: 10,
        page: currentPage,
      };

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
      setError('Failed to load requests. Please try again.');

      let errorMessage = 'Failed to load requests.';
      if (axios.isAxiosError(err)) {
        console.error('API Error Details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });
        errorMessage = err.response?.data?.message || 'Failed to load requests.';
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
  }, [serviceFilter, currentPage]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Helper function for error handling
  const handleError = (err: unknown) => {
    console.error('Error:', err);

    let errorMessage = 'An error occurred';
    if (axios.isAxiosError(err)) {
      errorMessage = err.response?.data?.message || errorMessage;
      console.error('Error Details:', err.response?.data);
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }
    
    setAlertModal({
      isOpen: true,
      message: errorMessage,
      variant: 'error',
    });
  };

  // Open Request Details Modal
  const openDetailsModal = async (request: ExtendedManageRequest) => {
    setDetailsModal({
      isOpen: true,
      request: request,
      loading: true,
    });

    try {
      // Fetch full details including form data
      const response = await manageRequestAPI.getById(request.request_id);
      if (response.data?.success && response.data.data) {
        const fullRequest = response.data.data as ExtendedManageRequest;
        setDetailsModal({
          isOpen: true,
          request: fullRequest,
          loading: false,
        });
      } else {
        setDetailsModal({
          isOpen: true,
          request: request,
          loading: false,
        });
      }
    } catch (err) {
      console.error('Error fetching request details:', err);
      setDetailsModal({
        isOpen: true,
        request: request,
        loading: false,
      });
    }
  };

  // Close Request Details Modal
  const closeDetailsModal = () => {
    setDetailsModal({
      isOpen: false,
      request: null,
      loading: false,
    });
  };

  // Open Priest Assignment Modal
  const openPriestAssignmentModal = async (
    request: ExtendedManageRequest,
    options?: { mode?: 'assign_and_approve' | 'assign_only'; priestOptional?: boolean }
  ) => {
    const priestOptional = options?.priestOptional ?? isCertificateRequest(request);
    const mode = options?.mode ?? (priestOptional ? 'assign_only' : 'assign_and_approve');
    console.log('Opening priest assignment:', {
      requestId: request.request_id,
      priestOptional,
      mode,
      existingPriest: request.assigned_priest,
    });
    setPriestModal(prev => ({
      ...prev,
      isOpen: true,
      request,
      selectedPriestId: request.assigned_priest || null,
      loading: true,
      priestOptional,
      mode,
    }));

    const priests = await fetchPriests(priestSlotForRequest(request));
    setPriestModal(prev => ({
      ...prev,
      priests,
      loading: false,
    }));
  };

  const approveRequestWithoutPriest = async (request: ExtendedManageRequest) => {
    const requestId = request.request_id;
    setUpdating(requestId);
    try {
      console.log('Approving without priest:', requestId, getServiceLabel(request));
      await manageRequestAPI.approve(requestId);
      setRequests((prev) => prev.filter((r) => r.request_id !== requestId));
      setAlertModal({
        isOpen: true,
        message: 'Request booked successfully!',
        variant: 'success',
      });
    } catch (err) {
      handleError(err);
    } finally {
      setUpdating(null);
    }
  };

  // Assign priest only (certificates can stay pending)
  const handleAssignPriestOnly = async () => {
    const { request, selectedPriestId } = priestModal;
    if (!request) return;

    if (!selectedPriestId) {
      setAlertModal({
        isOpen: true,
        message: 'Please select a priest to assign.',
        variant: 'warning',
      });
      return;
    }

    const requestId = request.request_id;
    setUpdating(requestId);
    setPriestModal(prev => ({ ...prev, loading: true }));

    try {
      console.log('Assigning priest only (no approve):', { requestId, priestId: selectedPriestId });
      await manageRequestAPI.assignPriest(requestId, selectedPriestId);

      const assignedPriest = priestModal.priests.find(p => p.user_id === selectedPriestId);
      setRequests(prev => prev.map(req =>
        req.request_id === requestId
          ? {
              ...req,
              assigned_priest: selectedPriestId,
              assignedPriest: assignedPriest || req.assignedPriest,
            }
          : req
      ));

      closePriestAssignmentModal();
      setAlertModal({
        isOpen: true,
        message: 'Priest assigned. You can book this certificate anytime from the status dropdown.',
        variant: 'success',
      });
    } catch (err) {
      handleError(err);
      setPriestModal(prev => ({ ...prev, loading: false }));
    } finally {
      setUpdating(null);
    }
  };

  // Handle Priest Assignment + Approve
  const handlePriestAssignment = async () => {
    const { request, selectedPriestId, priestOptional } = priestModal;
    if (!request) return;

    if (!selectedPriestId) {
      setAlertModal({
        isOpen: true,
        message: priestOptional
          ? 'Select a priest to assign, or go back and choose No to book without a priest.'
          : 'Please select a priest to assign.',
        variant: 'warning',
      });
      return;
    }

    const requestId = request.request_id;
    setUpdating(requestId);
    setPriestModal(prev => ({ ...prev, loading: true }));

    try {
      console.log('Assigning priest and approving request:', { requestId, priestId: selectedPriestId });
      await manageRequestAPI.assignPriest(requestId, selectedPriestId);
      await manageRequestAPI.approve(requestId);

      setRequests((prev) =>
        prev.filter((r) => r.request_id !== requestId)
      );

      setAlertModal({
        isOpen: true,
        message: 'Request booked and priest assigned successfully!',
        variant: 'success',
      });

      closePriestAssignmentModal();
    } catch (err) {
      handleError(err);
      setPriestModal(prev => ({ ...prev, loading: false }));
    } finally {
      setUpdating(null);
    }
  };

  // Close Priest Assignment Modal
  const closePriestAssignmentModal = () => {
    setPriestModal({
      isOpen: false,
      request: null,
      selectedPriestId: null,
      priests: [],
      loading: false,
      priestOptional: false,
      mode: 'assign_and_approve',
    });
  };

  // Update Status with Priest Assignment for 'approved'
  const updateStatus = async (request: ExtendedManageRequest, newStatus: ManageRequest['status']) => {
    // If approving, check for priest assignment
    if (newStatus === 'approved') {
      // Special intentions: approve without priest
      if (isSpecialIntentionRequest(request)) {
        setConfirmModal({
          isOpen: true,
          title: 'Confirm Booking',
          message: 'Book this special intention? A priest assignment is not required.',
          variant: 'warning',
          confirmText: 'Yes, Book',
          cancelText: 'Cancel',
          onConfirm: async () => {
            setConfirmModal((prev) => ({ ...prev, isOpen: false }));
            await approveRequestWithoutPriest(request);
          },
        });
        return;
      }

      // Certificates: optional priest — ask Yes/No
      if (isCertificateRequest(request)) {
        if (request.assigned_priest) {
          setConfirmModal({
            isOpen: true,
            title: 'Confirm Booking',
            message: 'This certificate already has an assigned priest. Proceed with booking?',
            variant: 'warning',
            confirmText: 'Yes, Book',
            cancelText: 'Cancel',
            onConfirm: async () => {
              setConfirmModal((prev) => ({ ...prev, isOpen: false }));
              await approveRequestWithoutPriest(request);
            },
          });
          return;
        }

        setConfirmModal({
          isOpen: true,
          title: 'Assign a Priest?',
          message:
            'Do you want to assign a priest to this certificate request? Choose Yes to pick a priest, or No to book without one.',
          variant: 'info',
          confirmText: 'Yes',
          cancelText: 'No',
          onConfirm: () => {
            setConfirmModal((prev) => ({ ...prev, isOpen: false, onCancel: undefined }));
            console.log('Certificate approve: user chose to assign priest', request.request_id);
            openPriestAssignmentModal(request, {
              priestOptional: true,
              mode: 'assign_and_approve',
            });
          },
          onCancel: async () => {
            console.log('Certificate approve: user chose no priest', request.request_id);
            await approveRequestWithoutPriest(request);
          },
        });
        return;
      }

      if (request.assigned_priest) {
        setConfirmModal({
          isOpen: true,
          title: 'Confirm Booking',
          message: `This request already has an assigned priest. Do you want to proceed with booking?`,
          variant: 'warning',
          confirmText: 'Yes, Book',
          cancelText: 'Cancel',
          onConfirm: async () => {
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            
            const requestId = request.request_id;
            setUpdating(requestId);

            try {
              await manageRequestAPI.approve(requestId);

              // Optimistic update: Remove the approved request from the list
              setRequests((prev) =>
                prev.filter((r) => r.request_id !== requestId)
              );

              setAlertModal({
                isOpen: true,
                message: 'Request booked successfully!',
                variant: 'success',
              });
            } catch (err) {
              handleError(err);
            } finally {
              setUpdating(null);
            }
          }
        });
      } else {
        openPriestAssignmentModal(request, {
          priestOptional: false,
          mode: 'assign_and_approve',
        });
      }
      return;
    }

    // For cancellation
    if (newStatus === 'cancelled') {
      setPromptModal({
        isOpen: true,
        title: 'Cancellation Reason',
        message: 'Please provide a cancellation reason:',
        placeholder: 'Enter reason...',
        required: true,
        confirmText: 'Confirm Cancellation',
        cancelText: 'Cancel',
        onConfirm: async (reason: string) => {
          setPromptModal(prev => ({ ...prev, isOpen: false }));
          const requestId = request.request_id;
          setUpdating(requestId);
          try {
            await manageRequestAPI.cancel(requestId, { cancelled_reason: reason });
            
            // Optimistic update: Remove the cancelled request from the list
            setRequests((prev) =>
              prev.filter((r) => r.request_id !== requestId)
            );

            setAlertModal({
              isOpen: true,
              message: 'Request cancelled successfully!',
              variant: 'success',
            });
          } catch (err) {
            handleError(err);
          } finally {
            setUpdating(null);
          }
        }
      });
      return;
    }
  };

  // Open Reschedule Modal
  const openRescheduleModal = (request: ExtendedManageRequest) => {
    setSelectedRequest(request);
    
    let timeValue = request.preferred_time || '';
    
    const timeMatch = timeValue.match(/(\d{2}):(\d{2})/);
    if (timeMatch) {
      timeValue = timeMatch[0];
    }
    
    setRescheduleData({
      preferred_date: request.preferred_date || '',
      preferred_time: timeValue,
      reschedule_reason: '',
    });
    setShowRescheduleModal(true);
  };

  // Close Reschedule Modal
  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setSelectedRequest(null);
    setRescheduleData({
      preferred_date: '',
      preferred_time: '',
      reschedule_reason: '',
    });
    setRescheduleSubmitting(false);
  };

  // Handle Reschedule Submit
  const handleReschedule = async () => {
    if (!selectedRequest) return;

    if (!rescheduleData.preferred_date || !rescheduleData.preferred_time) {
      setAlertModal({
        isOpen: true,
        message: 'Please select a date and time.',
        variant: 'warning',
      });
      return;
    }

    const slotIssue = timeProblem(
      rescheduleData.preferred_date,
      rescheduleData.preferred_time,
      bookedSlots,
      !rescheduleIsCertificate,
      rescheduleIsLong
    );
    if (slotIssue) {
      console.warn('[ManageRequests] Reschedule slot rejected', { ...rescheduleData, slotIssue });
      setAlertModal({ isOpen: true, message: slotIssue, variant: 'warning' });
      return;
    }

    if (!rescheduleData.reschedule_reason || rescheduleData.reschedule_reason.length < 10) {
      setAlertModal({
        isOpen: true,
        message: 'Please provide a reason (minimum 10 characters).',
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
      // Refetch to get updated data after reschedule
      fetchRequests();
    } catch (err: unknown) {
      console.error('Error rescheduling:', err);
      let errorMessage = 'Failed to reschedule request';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.message || errorMessage;
      }
      setAlertModal({
        isOpen: true,
        message: errorMessage,
        variant: 'error',
      });
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  // Updated: Only show pending/approved/cancelled options
  const getStatusOptions = (currentStatus: ManageRequest['status']): ManageRequest['status'][] => {
    if (currentStatus === 'pending') {
      return ['pending', 'approved', 'cancelled'];
    }
    if (currentStatus === 'approved') {
      return ['approved']; // Show only approved in dropdown
    }
    return [currentStatus];
  };

  const getServiceName = (request: ExtendedManageRequest): string | undefined => {
    return request.service?.service_type || request.service?.service_name;
  };

  const getServiceLabel = (request: ExtendedManageRequest): string => {
    const serviceName = getServiceName(request);
    const formHandler = request.service?.form_handler;

    if (
      serviceName === 'Special Intention' ||
      formHandler === 'special_intention' ||
      (serviceName || '').toLowerCase().includes('special intention')
    ) {
      return 'Special Intention';
    }

    if (serviceName) {
      return serviceName;
    }

    switch (request.form_type) {
      case 'baptism':
        return 'Baptism';
      case 'service':
        return 'Church Service';
      case 'certificate':
        return 'Certificate';
      default:
        return 'Unknown';
    }
  };

  const priestSlotForRequest = (request: ExtendedManageRequest) =>
    isCertificateRequest(request) ? {} : priestSlotFor(request.preferred_date, request.preferred_time);

  const isCertificateRequest = (request: ExtendedManageRequest): boolean => {
    if (request.form_type === 'certificate' || request.certificate_form_id || request.certificateForm) {
      return true;
    }
    const serviceName = (getServiceName(request) || '').toLowerCase();
    const category = (request.service as { category?: string } | undefined)?.category;
    return (
      category === 'certificate' ||
      serviceName.includes('certificate')
    );
  };

  const isSpecialIntentionRequest = (request: ExtendedManageRequest): boolean => {
    const serviceName = getServiceName(request);
    const formHandler = request.service?.form_handler;
    return (
      serviceName === 'Special Intention' ||
      formHandler === 'special_intention' ||
      (serviceName || '').toLowerCase().includes('special intention')
    );
  };

  const getPaymentStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      unpaid: 'bg-slate-100 text-slate-700 border-slate-200',
      partial: 'bg-blue-50 text-blue-700 border-blue-200',
      paid: 'bg-blue-600 text-white border-blue-600',
    };
    return colors[status] || 'bg-slate-100 text-slate-700 border-slate-200';
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

  const formatDateTime = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const getRescheduleButtonLabel = (request: ExtendedManageRequest): string => {
    const count = request.reschedule_count || 0;
    // Only show count if there are reschedules
    return count > 0 ? `Reschedule (${count})` : 'Reschedule';
  };

  // Get assigned priest name
  const getAssignedPriestName = (request: ExtendedManageRequest): string => {
    if (request.assignedPriest) {
      return getUserFullName(request.assignedPriest);
    }
    if (request.assigned_priest) {
      return 'Assigned (ID: ' + request.assigned_priest + ')';
    }
    return 'Not Assigned';
  };

  // Render form details based on request type
  const renderFormDetails = (request: ExtendedManageRequest) => {
    if (!request) return null;

    const formType = request.form_type;
    
    if (formType === 'baptism' && request.baptismForm) {
      const form = request.baptismForm;
      // Handle godparents - check if they exist and have the right structure
      const godparents = (form.godparents || []) as Godparent[];
      
      return (
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-700 border-b pb-2">Baptism Details</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Child's Full Name:</span>
              <p className="font-medium">{form.child_first_name} {form.child_middle_name || ''} {form.child_last_name}</p>
            </div>
            <div>
              <span className="text-gray-500">Date of Birth:</span>
              <p className="font-medium">{formatDateOnly(form.child_birth_date)}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Place of Birth:</span>
              <p className="font-medium">{form.child_birth_place || 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-500">Mother:</span>
              <p className="font-medium">{form.mother_first_name} {form.mother_middle_name || ''} {form.mother_last_name}</p>
            </div>
            <div>
              <span className="text-gray-500">Father:</span>
              <p className="font-medium">{form.father_first_name} {form.father_middle_name || ''} {form.father_last_name}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Contact:</span>
              <p className="font-medium">{formatPhilippinePhone(form.contact_number)}</p>
            </div>
            <div>
              <span className="text-gray-500">Residency:</span>
              <p className="font-medium">{getResidencyLabel(request.is_resident)}</p>
            </div>
            {shouldShowNonResidentAddress(request.is_resident, form.address) && (
              <div className="col-span-2">
                <span className="text-gray-500">Address:</span>
                <p className="font-medium">{form.address}</p>
              </div>
            )}
            {godparents.length > 0 && (
              <div className="col-span-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <span className="text-slate-700 font-medium block mb-2 flex items-center gap-2">
                  <Users size={16} className="text-blue-600" />
                  Godparents ({godparents.length})
                </span>
                <div className="space-y-1.5">
                  {godparents.map((gp, idx) => {
                    let name = '';
                    let relationship = '';
                    
                    if (isBaptismFormGodparent(gp)) {
                      name = gp.godparent_name;
                      relationship = gp.relationship;
                    } else if (isManageRequestGodparent(gp)) {
                      name = gp.name;
                      relationship = gp.type;
                    }
                    
                    const isGodfather = relationship === 'godfather';
                    
                    return (
                      <div key={idx} className="flex items-center gap-2 p-1.5 bg-white rounded-md shadow-sm">
                        <span className={`flex-shrink-0 p-1 rounded-full ${isGodfather ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                          <UserIcon size={14} />
                        </span>
                        <span className="font-medium text-gray-800">
                          {name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
                          isGodfather 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-pink-100 text-pink-700'
                        }`}>
                          {isGodfather ? 'Godfather' : 'Godmother'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (formType === 'service' && request.serviceForm) {
      const form = request.serviceForm;
      const serviceType = request.service?.service_type || form.service_name || 'Service';
      const isSpecialIntention =
        serviceType === 'Special Intention' ||
        request.service?.form_handler === 'special_intention';

      if (isSpecialIntention) {
        return (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-700 border-b pb-2">Special Intention Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Service</span>
                <p className="font-medium">Special Intention</p>
              </div>
              <div>
                <span className="text-gray-500">Parishioner Name</span>
                <p className="font-medium">{form.full_name}</p>
              </div>
              <div>
                <span className="text-gray-500">Residency</span>
                <p className="font-medium">{getResidencyLabel(request.is_resident)}</p>
              </div>
              {shouldShowNonResidentAddress(request.is_resident, form.address) && (
                <div className="col-span-2">
                  <span className="text-gray-500">Address</span>
                  <p className="font-medium">{form.address}</p>
                </div>
              )}
              {form.address && form.address !== 'Parish resident' && request.is_resident !== false && (
              <div className="col-span-2">
                <span className="text-gray-500">Intention</span>
                <p className="font-medium whitespace-pre-wrap">{form.address || 'N/A'}</p>
              </div>
              )}
              <div>
                <span className="text-gray-500">Intention Date</span>
                <p className="font-medium">{formatDateOnly(request.preferred_date)}</p>
              </div>
              <div>
                <span className="text-gray-500">Preferred Time</span>
                <p className="font-medium">{formatTimeDisplay12Hour(request.preferred_time)}</p>
              </div>
              <div>
                <span className="text-gray-500">Offering</span>
                <p className="font-medium">₱{(request.service?.fee || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-700 border-b pb-2">Service Details</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Service Name:</span>
              <p className="font-medium">{serviceType}</p>
            </div>
            <div>
              <span className="text-gray-500">Full Name:</span>
              <p className="font-medium">{form.full_name}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Contact:</span>
              <p className="font-medium">{formatPhilippinePhone(form.contact_number)}</p>
            </div>
            <div>
              <span className="text-gray-500">Residency:</span>
              <p className="font-medium">{getResidencyLabel(request.is_resident)}</p>
            </div>
            {shouldShowNonResidentAddress(request.is_resident, form.address) && (
              <div className="col-span-2">
                <span className="text-gray-500">Address:</span>
                <p className="font-medium">{form.address}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (formType === 'certificate' && request.certificateForm) {
      const form = request.certificateForm;
      const certificateTypeName =
        request.service?.service_type || form.service_name || form.certificate_type_label || form.certificate_type || '';
      const isMarriageCertificate = certificateTypeName.toLowerCase().includes('marriage');
      return (
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-700 border-b pb-2">Certificate Details</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Certificate Type:</span>
              <p className="font-medium">{certificateTypeName || 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-500">Full Name:</span>
              <p className="font-medium">{form.full_name}</p>
            </div>
            {isMarriageCertificate ? (
              <div>
                <span className="text-gray-500">Marriage Date:</span>
                <p className="font-medium">{form.marriage_date ? formatDateOnly(form.marriage_date) : 'N/A'}</p>
              </div>
            ) : (
              <>
                <div>
                  <span className="text-gray-500">Father&apos;s Name:</span>
                  <p className="font-medium">{form.father_name || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Mother&apos;s Name:</span>
                  <p className="font-medium">{form.mother_name || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Birth Date:</span>
                  <p className="font-medium">{form.birth_date ? formatDateOnly(form.birth_date) : 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Place of Birth:</span>
                  <p className="font-medium">{form.birth_place || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Baptism Date:</span>
                  <p className="font-medium">{form.baptism_date ? formatDateOnly(form.baptism_date) : 'N/A'}</p>
                </div>
              </>
            )}
            <div className="col-span-2">
              <span className="text-gray-500">Contact:</span>
              <p className="font-medium">{formatPhilippinePhone(form.contact_number)}</p>
            </div>
            <div>
              <span className="text-gray-500">Residency:</span>
              <p className="font-medium">{getResidencyLabel(request.is_resident)}</p>
            </div>
            {shouldShowNonResidentAddress(request.is_resident, form.address) && (
              <div className="col-span-2">
                <span className="text-gray-500">Address:</span>
                <p className="font-medium">{form.address}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="text-sm text-gray-500">
        No additional details available for this request.
      </div>
    );
  };

  const serviceFilters: { value: ServiceFilterType; label: string }[] = [
    { value: 'all', label: 'All Services' },
    { value: 'baptism', label: 'Baptism' },
    { value: 'service', label: 'Church Service' },
    { value: 'certificate', label: 'Certificate' },
  ];

  const expiringSoon = requests.filter((r) => r.status === 'pending' && expiryState(r.expires_at, nowTick) === 'soon');
  const overdue = requests.filter((r) => r.status === 'pending' && expiryState(r.expires_at, nowTick) === 'overdue');
  const deadlineMinutes = (() => {
    const r = requests.find((x) => x.expires_at && x.created_at);
    return r ? Math.round((new Date(r.expires_at as string).getTime() - new Date(r.created_at as string).getTime()) / 60000) : 60;
  })();
  const expiryMinutesLabel = deadlineMinutes % 60 === 0 ? `${deadlineMinutes / 60} hour${deadlineMinutes === 60 ? '' : 's'}` : `${deadlineMinutes} minutes`;

  return (
    <div>
      <PageHeader
        icon={ClipboardList}
        title="Pending Requests"
        description={`${requests.length} request${requests.length !== 1 ? 's' : ''} awaiting action`}
        action={
          <button
            onClick={() => fetchRequests()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Refresh
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Refresh
              </>
            )}
          </button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {serviceFilters.map(({ value, label }) => (
          <FilterPill
            key={value}
            label={label}
            active={serviceFilter === value}
            onClick={() => handleServiceFilter(value)}
            icon={value === 'all' ? Church : getFilterServiceIcon(value)}
          />
        ))}
      </div>

      {overdue.length > 0 && (
        <div role="alert" className="mb-3 flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" aria-hidden />
          <p>
            <strong className="font-semibold">
              {overdue.length === 1 ? '1 request is overdue.' : `${overdue.length} requests are overdue.`}
            </strong>{' '}
            {overdue.length === 1 ? 'It has' : 'They have'} waited longer than {expiryMinutesLabel}. Approve, assign a priest, or cancel {overdue.length === 1 ? 'it' : 'them'}.
          </p>
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
          <p>
            <strong className="font-semibold">
              {expiringSoon.length === 1 ? '1 request becomes overdue' : `${expiringSoon.length} requests become overdue`} within {EXPIRY_WARN_MINUTES} minutes.
            </strong>{' '}
            Approve {expiringSoon.length === 1 ? 'it' : 'them'} or assign a priest soon.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Requested by</th>
              <th className="px-4 py-3">Schedule</th>
              <th className="px-4 py-3">Time left</th>
              <th className="px-4 py-3">Priest</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && requests.length === 0 ? (
              <SecretaryTableSkeleton columns={8} />
            ) : error ? (
              <tr>
                <td colSpan={8} className="px-4 py-16">
                  <div className="text-center">
                    <p className="text-red-500 mb-4">{error}</p>
                    <button
                      onClick={() => fetchRequests()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Try Again
                    </button>
                  </div>
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState title="No pending requests found" description="All requests have been processed or no submissions yet." />
                </td>
              </tr>
            ) : (
              requests.map((request, index) => {
                const requestId = request.request_id;
                const isUpdating = updating === requestId;
                const canReschedule = request.can_be_rescheduled ?? false;
                const isPending = request.status === 'pending';
                const isApproved = request.status === 'approved';
                const isCancelled = request.status === 'cancelled';
                const rowExpiry = isPending ? expiryState(request.expires_at, nowTick) : 'none';
                const submitted = request.created_at ? new Date(request.created_at) : null;
                const address = getRequestFormAddress(request);

                return (
                  <tr
                    key={`${requestId}-${index}`}
                    className={`align-top transition-colors ${
                      rowExpiry === 'overdue'
                        ? 'bg-red-50 hover:bg-red-100/60'
                        : rowExpiry === 'soon'
                          ? 'bg-amber-50/70 hover:bg-amber-50'
                          : 'hover:bg-slate-50'
                    }`}
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
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{getServiceLabel(request)}</p>
                          <p className="text-xs text-slate-500">#{requestId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-900">{getUserFullName(request.user)}</p>
                      <p className="mt-0.5 text-xs tabular-nums text-slate-500">{getFormattedRequestContactNumber(request)}</p>
                      <span
                        className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          isParishResident(request.is_resident) ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {getResidencyLabel(request.is_resident)}
                      </span>
                      {shouldShowNonResidentAddress(request.is_resident, address) && (
                        <p className="mt-1 max-w-[14rem] break-words text-xs text-slate-500">{address}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <p className="font-medium text-slate-900">{formatDateOnly(request.preferred_date)}</p>
                      <p className="text-xs text-slate-500">{formatTimeDisplay12Hour(request.preferred_time)}</p>
                    </td>
                    <td className="px-4 py-4">
                      {isPending ? (
                        request.expires_at ? (
                          <ExpiryIndicator expiresAt={request.expires_at} />
                        ) : (
                          <span className="text-xs text-slate-500">Doesn&apos;t expire</span>
                        )
                      ) : (
                        <StatusBadge status={request.status} label={getStatusLabel(request.status).toUpperCase()} />
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-slate-700">
                        {isSpecialIntentionRequest(request)
                          ? 'Not required'
                          : isCertificateRequest(request) && !request.assigned_priest
                            ? 'Optional'
                            : getAssignedPriestName(request)}
                      </p>
                      {isPending && !isSpecialIntentionRequest(request) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPriestAssignmentModal(request, {
                              priestOptional: isCertificateRequest(request),
                              mode: isCertificateRequest(request) ? 'assign_only' : 'assign_and_approve',
                            });
                          }}
                          className="mt-1 text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 disabled:opacity-50"
                          disabled={isUpdating}
                        >
                          {request.assigned_priest ? 'Change priest' : 'Assign priest'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getPaymentStatusColor(request.payment_status)}`}>
                        {request.payment_status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {submitted ? (
                        <>
                          <p className="text-slate-700">{submitted.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          <p className="text-xs tabular-nums text-slate-500">{submitted.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                        </>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="ml-auto flex w-36 flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openDetailsModal(request)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <Eye size={14} aria-hidden /> View details
                        </button>

                        {isCancelled ? (
                          <StatusBadge status="cancelled" label="Cancelled" />
                        ) : isPending ? (
                          <select
                            onChange={(e) => updateStatus(request, e.target.value as ManageRequest['status'])}
                            value={request.status}
                            disabled={isUpdating}
                            aria-label={`Status of request #${requestId}`}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          >
                            {getStatusOptions(request.status).map((option) => (
                              <option key={option} value={option}>
                                {getStatusLabel(option).toUpperCase()}
                              </option>
                            ))}
                          </select>
                        ) : isApproved ? (
                          <StatusBadge status="approved" label="Booked" />
                        ) : null}

                        {canReschedule && (
                          <button
                            onClick={() => openRescheduleModal(request)}
                            disabled={isUpdating}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
                          >
                            {getRescheduleButtonLabel(request)}
                          </button>
                        )}

                        {isUpdating && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto" aria-label="Updating" />
                        )}
                      </div>
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

      {/* Request Details Modal */}
      {detailsModal.isOpen && detailsModal.request && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Request Details</h3>
              <ModalCloseButton onClick={closeDetailsModal} />
            </div>
            
            {detailsModal.loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-500">Loading details...</span>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <span className="text-sm text-gray-500">Request ID</span>
                    <p className="font-semibold text-gray-800">#{detailsModal.request.request_id}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Status</span>
                    <p>
                      <StatusBadge status={detailsModal.request.status} label={getStatusLabel(detailsModal.request.status).toUpperCase()} />
                    </p>
                    {detailsModal.request.status === 'pending' && <ExpiryIndicator expiresAt={detailsModal.request.expires_at} />}
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Service</span>
                    <p className="font-semibold text-gray-800">{getServiceLabel(detailsModal.request)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Payment Status</span>
                    <p>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPaymentStatusColor(detailsModal.request.payment_status)}`}>
                        {detailsModal.request.payment_status.toUpperCase()}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Amount Paid</span>
                    <p className="font-semibold text-gray-800">₱{detailsModal.request.amount_paid?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Service Fee</span>
                    <p className="font-semibold text-gray-800">₱{detailsModal.request.service?.fee?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>

                {/* User Info */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700 border-b pb-2">Requester Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Full Name</span>
                      <p className="font-medium">{getUserFullName(detailsModal.request.user)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Contact Number</span>
                      <p className="font-medium">{getFormattedRequestContactNumber(detailsModal.request)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Residency</span>
                      <p className="font-medium">{getResidencyLabel(detailsModal.request.is_resident)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Email</span>
                      <p className="font-medium">{detailsModal.request.user?.email || 'N/A'}</p>
                    </div>
                    {shouldShowNonResidentAddress(
                      detailsModal.request.is_resident,
                      getRequestFormAddress(detailsModal.request)
                    ) && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Address</span>
                        <p className="font-medium">{getRequestFormAddress(detailsModal.request)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Schedule Info */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700 border-b pb-2">
                    {detailsModal.request.service?.service_type === 'Special Intention' ||
                    detailsModal.request.service?.form_handler === 'special_intention'
                      ? 'Preferred Schedule'
                      : 'Schedule Information'}
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">
                        {detailsModal.request.service?.service_type === 'Special Intention' ||
                        detailsModal.request.service?.form_handler === 'special_intention'
                          ? 'Date'
                          : 'Preferred Date'}
                      </span>
                      <p className="font-medium">{formatDateOnly(detailsModal.request.preferred_date)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Preferred Time</span>
                      <p className="font-medium">{formatTimeDisplay12Hour(detailsModal.request.preferred_time)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Created At</span>
                      <p className="font-medium">{formatDateTime(detailsModal.request.created_at)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Updated At</span>
                      <p className="font-medium">{formatDateTime(detailsModal.request.updated_at)}</p>
                    </div>
                  </div>
                </div>

                {/* Priest Assignment Info — hidden for special intentions only */}
                {!isSpecialIntentionRequest(detailsModal.request) && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700 border-b pb-2">
                    Priest Assignment
                    {isCertificateRequest(detailsModal.request) && (
                      <span className="ml-2 text-xs font-normal text-gray-500">(optional)</span>
                    )}
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Assigned Priest</span>
                      <p className="font-medium">
                        {isCertificateRequest(detailsModal.request) && !detailsModal.request.assigned_priest
                          ? 'Optional — not assigned'
                          : getAssignedPriestName(detailsModal.request)}
                      </p>
                    </div>
                    {detailsModal.request.approved_at && (
                      <div>
                        <span className="text-gray-500">Booked At</span>
                        <p className="font-medium">{formatDateTime(detailsModal.request.approved_at)}</p>
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* Form Details */}
                {renderFormDetails(detailsModal.request)}

                {/* Reschedule Info - Only show when there are actual reschedules */}
                {(detailsModal.request.reschedule_count ?? 0) > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-700 border-b pb-2">Reschedule Information</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Reschedule Count</span>
                        <p className="font-medium">{detailsModal.request.reschedule_count}</p>
                      </div>
                      {detailsModal.request.reschedule_reason && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Reschedule Reason</span>
                          <p className="font-medium">{detailsModal.request.reschedule_reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Cancellation Info */}
                {detailsModal.request.status === 'cancelled' && detailsModal.request.cancelled_reason && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-700 border-b pb-2">Cancellation Information</h4>
                    <div className="text-sm">
                      <span className="text-gray-500">Cancellation Reason</span>
                      <p className="font-medium text-red-600">{detailsModal.request.cancelled_reason}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end">
              <button
                onClick={closeDetailsModal}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Reschedule Request</h3>
              <ModalCloseButton onClick={closeRescheduleModal} />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User
                </label>
                <p className="text-gray-600">{getUserFullName(selectedRequest.user)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service
                </label>
                <p className="text-gray-600">
                  {getServiceLabel(selectedRequest)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Preferred Date *
                </label>
                <ServiceDatePicker
                  ariaLabel="New preferred date"
                  value={rescheduleData.preferred_date}
                  onChange={(date) => setRescheduleData({ ...rescheduleData, preferred_date: date, preferred_time: '' })}
                  blockFullyBooked={!rescheduleIsCertificate}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Preferred Time *
                </label>
                <select
                  value={rescheduleData.preferred_time}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, preferred_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">{rescheduleData.preferred_date ? 'Select time' : 'Pick a date first'}</option>
                  {buildTimeOptions(rescheduleData.preferred_date, bookedSlots, !rescheduleIsCertificate, rescheduleIsLong).map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                      {option.display}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reschedule Reason *
                </label>
                <textarea
                  value={rescheduleData.reschedule_reason}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, reschedule_reason: e.target.value })}
                  placeholder="Please explain why you are rescheduling..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Minimum 10 characters
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={closeRescheduleModal}
                disabled={rescheduleSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={rescheduleSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {rescheduleSubmitting ? 'Processing...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Priest Assignment Modal */}
      {priestModal.isOpen && (
        <div className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                {priestModal.mode === 'assign_only'
                  ? 'Assign Priest'
                  : priestModal.priestOptional
                    ? 'Assign Priest & Book'
                    : 'Assign Priest & Book Request'}
              </h3>
              <ModalCloseButton onClick={closePriestAssignmentModal} />
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Request Details
                </label>
                <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">User:</span> {priestModal.request ? getUserFullName(priestModal.request.user) : 'N/A'}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Service:</span> {priestModal.request ? getServiceLabel(priestModal.request) : 'N/A'}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Date:</span> {priestModal.request ? formatDateOnly(priestModal.request.preferred_date) : 'N/A'}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Time:</span> {priestModal.request ? formatTimeDisplay12Hour(priestModal.request.preferred_time) : 'N/A'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Priest {priestModal.priestOptional ? '(optional step)' : '*'}
                </label>
                {priestModal.loading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-sm text-gray-500">Loading priests...</span>
                  </div>
                ) : priestModal.priests.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-amber-600">No priests available</p>
                    <button
                      onClick={async () => {
                        setPriestModal(prev => ({ ...prev, loading: true }));
                        const priests = await fetchPriests(priestModal.request ? priestSlotForRequest(priestModal.request) : {});
                        setPriestModal(prev => ({ ...prev, priests, loading: false }));
                      }}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Refresh List
                    </button>
                  </div>
                ) : (
                  <select
                    value={priestModal.selectedPriestId || ''}
                    onChange={(e) => setPriestModal(prev => ({ 
                      ...prev, 
                      selectedPriestId: e.target.value ? Number(e.target.value) : null 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select a priest...</option>
                    {priestModal.priests.map((priest) => (
                      <option
                        key={priest.user_id}
                        value={priest.user_id}
                        disabled={!!priest.availability_problem && priest.user_id !== priestModal.request?.assigned_priest}
                        title={priest.availability_problem || undefined}
                      >
                        {getUserFullName(priest)}
                        {priest.availability_problem ? ' — unavailable at this time' : ''}
                      </option>
                    ))}
                  </select>
                )}
                {priestModal.priests.length > 0 && (() => {
                  const unavailable = priestModal.priests.filter((p) => p.availability_problem);
                  const selected = priestModal.priests.find((p) => p.user_id === priestModal.selectedPriestId);
                  return (
                    <>
                      <p className="text-xs text-gray-400 mt-1">
                        {priestModal.priests.length - unavailable.length} of {priestModal.priests.length} priest
                        {priestModal.priests.length > 1 ? 's' : ''} free at this date and time
                      </p>
                      {selected?.availability_problem && (
                        <p className="mt-1 text-xs text-amber-700">{selected.availability_problem} Choose another priest.</p>
                      )}
                      {unavailable.length > 0 && (
                        <ul className="mt-2 space-y-0.5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                          {unavailable.map((p) => (
                            <li key={p.user_id}>{p.availability_problem}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  );
                })()}
              </div>

              {priestModal.selectedPriestId && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700 flex items-center gap-2">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>
                      {priestModal.mode === 'assign_only'
                        ? 'This will assign the priest. The request stays pending until you book it.'
                        : 'This will assign the priest and book the request in one step.'}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={closePriestAssignmentModal}
                disabled={priestModal.loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={priestModal.mode === 'assign_only' ? handleAssignPriestOnly : handlePriestAssignment}
                disabled={
                  priestModal.loading ||
                  !priestModal.selectedPriestId ||
                  priestModal.priests.length === 0 ||
                  !!priestModal.priests.find((p) => p.user_id === priestModal.selectedPriestId)?.availability_problem
                }
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {priestModal.loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : priestModal.mode === 'assign_only' ? (
                  'Assign Priest'
                ) : (
                  'Assign & Book'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                {confirmModal.title || 'Confirm Action'}
              </h3>
              <ModalCloseButton onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false, onCancel: undefined }))} />
            </div>
            <div className="p-4">
              <p className="text-gray-600">{confirmModal.message}</p>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  const onCancel = confirmModal.onCancel;
                  setConfirmModal(prev => ({ ...prev, isOpen: false, onCancel: undefined }));
                  if (onCancel) {
                    onCancel();
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {confirmModal.cancelText || 'Cancel'}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  confirmModal.variant === 'danger' 
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                    : confirmModal.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                } focus:outline-none focus:ring-2 focus:ring-offset-2`}
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {promptModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                {promptModal.title || 'Enter Information'}
              </h3>
              <ModalCloseButton onClick={() => setPromptModal(prev => ({ ...prev, isOpen: false }))} />
            </div>
            <div className="p-4">
              {promptModal.message && (
                <p className="text-gray-600 mb-4">{promptModal.message}</p>
              )}
              <input
                type="text"
                placeholder={promptModal.placeholder || 'Enter your response...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 prompt-input"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    if (!promptModal.required || input.value.trim()) {
                      promptModal.onConfirm(input.value);
                    }
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setPromptModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {promptModal.cancelText || 'Cancel'}
              </button>
              <button
                onClick={() => {
                  const input = document.querySelector('.prompt-input') as HTMLInputElement;
                  if (input && (!promptModal.required || input.value.trim())) {
                    promptModal.onConfirm(input.value);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {promptModal.confirmText || 'Confirm'}
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
              <h3 className="text-lg font-bold text-slate-800">
                {alertModal.title || 'Notification'}
              </h3>
              <ModalCloseButton onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))} />
            </div>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {alertModal.variant === 'success' && <CheckCircle2 className="text-blue-600" size={24} />}
                  {alertModal.variant === 'error' && <XCircle className="text-red-600" size={24} />}
                  {alertModal.variant === 'warning' && <AlertTriangle className="text-amber-600" size={24} />}
                  {(alertModal.variant === 'info' || !alertModal.variant) && <Info className="text-blue-600" size={24} />}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">{alertModal.message}</p>
              </div>
            </div>
            <div className="flex justify-end p-4 border-t border-slate-200">
              <button
                onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
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

export default ManageRequests;