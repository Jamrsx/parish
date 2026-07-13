import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { manageRequestAPI } from '../../../../library/manage-request';
import { api } from '../../../../library/api';
import type { ManageRequest, ManageRequestFilters, RescheduleData } from '../../../../library/manage-request';
import type { User } from '../../../../library/AuthStorage';

// TYPE DEFINITIONS 
type ServiceFilterType = 'all' | 'baptism' | 'service' | 'certificate';

// Time options for dropdown
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
}

// Request Details Modal State
interface RequestDetailsModalState {
  isOpen: boolean;
  request: ExtendedManageRequest | null;
  loading: boolean;
}

// Type for godparent from baptism-form.ts
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

  // Priest Assignment Modal State
  const [priestModal, setPriestModal] = useState<PriestAssignmentModalState>({
    isOpen: false,
    request: null,
    selectedPriestId: null,
    priests: [],
    loading: false,
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
  const fetchPriests = useCallback(async (): Promise<User[]> => {
    try {
      const response = await api.get('/admin/users', { 
        params: { role: 'priest', per_page: 100 } 
      });
      
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
  const openPriestAssignmentModal = async (request: ExtendedManageRequest) => {
    setPriestModal(prev => ({ 
      ...prev, 
      isOpen: true, 
      request,
      selectedPriestId: request.assigned_priest || null,
      loading: true 
    }));

    const priests = await fetchPriests();
    setPriestModal(prev => ({ 
      ...prev, 
      priests,
      loading: false 
    }));
  };

  // Handle Priest Assignment
  const handlePriestAssignment = async () => {
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

    try {
      await manageRequestAPI.assignPriest(requestId, selectedPriestId);
      await manageRequestAPI.approve(requestId);

      // Optimistic update: Remove the approved request from the list
      setRequests((prev) =>
        prev.filter((r) => r.request_id !== requestId)
      );

      setAlertModal({
        isOpen: true,
        message: 'Request approved and priest assigned successfully!',
        variant: 'success',
      });

      setPriestModal(prev => ({ ...prev, isOpen: false }));
      
    } catch (err) {
      handleError(err);
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
    });
  };

  // Update Status with Priest Assignment for 'approved'
  const updateStatus = async (request: ExtendedManageRequest, newStatus: ManageRequest['status']) => {
    // If approving, check for priest assignment
    if (newStatus === 'approved') {
      if (request.assigned_priest) {
        setConfirmModal({
          isOpen: true,
          title: 'Confirm Approval',
          message: `This request already has an assigned priest. Do you want to proceed with approval?`,
          variant: 'warning',
          confirmText: 'Yes, Approve',
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
                message: 'Request approved successfully!',
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
        openPriestAssignmentModal(request);
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
    return count > 0 ? `🔄 Reschedule (${count})` : '🔄 Reschedule';
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
              <span className="text-gray-500">Address:</span>
              <p className="font-medium">{form.address}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Contact:</span>
              <p className="font-medium">{form.contact_number}</p>
            </div>
            {godparents.length > 0 && (
              <div className="col-span-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <span className="text-gray-700 font-medium block mb-2">
                  👨‍👩‍👧‍👦 Godparents ({godparents.length})
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
                        <span className="text-lg">
                          {isGodfather ? '👨' : '👩'}
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
      return (
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-700 border-b pb-2">Service Details</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Service Name:</span>
              <p className="font-medium">{form.service_name || 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-500">Full Name:</span>
              <p className="font-medium">{form.full_name}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Address:</span>
              <p className="font-medium">{form.address}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Contact:</span>
              <p className="font-medium">{form.contact_number}</p>
            </div>
          </div>
        </div>
      );
    }

    if (formType === 'certificate' && request.certificateForm) {
      const form = request.certificateForm;
      return (
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-700 border-b pb-2">Certificate Details</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Certificate Type:</span>
              <p className="font-medium">{form.certificate_type_label || form.certificate_type || 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-500">Full Name:</span>
              <p className="font-medium">{form.full_name}</p>
            </div>
            <div>
              <span className="text-gray-500">Birth Date:</span>
              <p className="font-medium">{form.birth_date ? formatDateOnly(form.birth_date) : 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-500">Marriage Date:</span>
              <p className="font-medium">{form.marriage_date ? formatDateOnly(form.marriage_date) : 'N/A'}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Address:</span>
              <p className="font-medium">{form.address}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Contact:</span>
              <p className="font-medium">{form.contact_number}</p>
            </div>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading pending requests...</p>
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Pending Requests</h2>
            <p className="text-sm text-gray-500 mt-1">
              {requests.length} request{requests.length !== 1 ? 's' : ''} awaiting action
            </p>
          </div>
          <button
            onClick={() => fetchRequests()}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Loading...
              </>
            ) : (
              <>
                <span>🔄</span> Refresh
              </>
            )}
          </button>
        </div>

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
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl shadow border border-gray-200 bg-white">
        <table className="min-w-full">
          <thead className="bg-gradient-to-r from-blue-600 to-blue-700">
            <tr>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Service</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">User</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Preferred Schedule</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Contact</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Status</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Assigned Priest</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Payment</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Submitted</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-14 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-5xl mb-3">📭</span>
                    <p className="text-gray-500 font-medium">No pending requests found</p>
                  </div>
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
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}>
                        {request.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-700">
                          {getAssignedPriestName(request)}
                        </span>
                        {isPending && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPriestAssignmentModal(request);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 underline mt-1 text-left"
                            disabled={isUpdating}
                          >
                            {request.assigned_priest ? 'Change Priest' : 'Assign Priest'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPaymentStatusColor(request.payment_status)}`}>
                        {request.payment_status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-500 text-sm">
                      {request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* View Details Button */}
                        <button
                          onClick={() => openDetailsModal(request)}
                          className="text-sm px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <span>👁️</span> View Details
                        </button>
                        
                        {isCancelled ? (
                          // Cancelled - show status badge only
                          <div className="flex items-center gap-1.5">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}>
                              CANCELLED
                            </span>
                          </div>
                        ) : isPending ? (
                          // Pending - show dropdown
                          <select
                            onChange={(e) => updateStatus(request, e.target.value as ManageRequest['status'])}
                            value={request.status}
                            disabled={isUpdating}
                            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white hover:border-blue-300 transition-colors"
                          >
                            {getStatusOptions(request.status).map((option) => (
                              <option key={option} value={option}>
                                {option.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        ) : isApproved ? (
                          // Approved - show status badge only
                          <div className="flex items-center gap-1.5">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}>
                              ✅ APPROVED
                            </span>
                          </div>
                        ) : null}
                        
                        {/* Reschedule Button - only for pending and approved */}
                        {canReschedule && (
                          <button
                            onClick={() => openRescheduleModal(request)}
                            disabled={isUpdating}
                            className="text-sm px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
                          >
                            {getRescheduleButtonLabel(request)}
                          </button>
                        )}
                        
                        {isUpdating && (
                          <div className="mt-1">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto"></div>
                          </div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Request Details</h3>
              <button
                onClick={closeDetailsModal}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              >
                ✕
              </button>
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
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(detailsModal.request.status)}`}>
                        {detailsModal.request.status.toUpperCase()}
                      </span>
                    </p>
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
                      <p className="font-medium">{detailsModal.request.user?.contact_number || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Email</span>
                      <p className="font-medium">{detailsModal.request.user?.email || 'N/A'}</p>
                    </div>
                    {detailsModal.request.user?.address && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Address</span>
                        <p className="font-medium">{detailsModal.request.user.address}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Schedule Info */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700 border-b pb-2">Schedule Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Preferred Date</span>
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

                {/* Priest Assignment Info */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700 border-b pb-2">Priest Assignment</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Assigned Priest</span>
                      <p className="font-medium">{getAssignedPriestName(detailsModal.request)}</p>
                    </div>
                    {detailsModal.request.approved_at && (
                      <div>
                        <span className="text-gray-500">Approved At</span>
                        <p className="font-medium">{formatDateTime(detailsModal.request.approved_at)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Details */}
                {renderFormDetails(detailsModal.request)}

                {/* Reschedule Info - Only show when there are actual reschedules */}
                {detailsModal.request.reschedule_count && detailsModal.request.reschedule_count > 0 && (
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
              <button
                onClick={closeRescheduleModal}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                ✕
              </button>
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
                <input
                  type="date"
                  value={rescheduleData.preferred_date}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, preferred_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <option value="">Select time</option>
                  {timeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                Assign Priest & Approve Request
              </h3>
              <button
                onClick={closePriestAssignmentModal}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                disabled={priestModal.loading}
              >
                ✕
              </button>
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
                  Select Priest *
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
                        const priests = await fetchPriests();
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
                      <option key={priest.user_id} value={priest.user_id}>
                        {getUserFullName(priest)}
                      </option>
                    ))}
                  </select>
                )}
                {priestModal.priests.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Showing {priestModal.priests.length} available priest{priestModal.priests.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {priestModal.selectedPriestId && (
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                  <p className="text-sm text-emerald-700 flex items-center gap-2">
                    <span>✅</span>
                    <span>This will assign the priest and approve the request in one step.</span>
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
                onClick={handlePriestAssignment}
                disabled={priestModal.loading || !priestModal.selectedPriestId || priestModal.priests.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {priestModal.loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  'Assign & Approve'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                {confirmModal.title || 'Confirm Action'}
              </h3>
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <p className="text-gray-600">{confirmModal.message}</p>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
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
              <button
                onClick={() => setPromptModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              >
                ✕
              </button>
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

export default ManageRequests;