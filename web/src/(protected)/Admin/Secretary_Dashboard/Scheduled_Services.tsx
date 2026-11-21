import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { manageRequestAPI } from "../../../../library/manage-request";
import type { RequestStatus, ManageRequest, RescheduleData } from "../../../../library/manage-request";
import { usersAPI } from "../../../../library/api";
import type { User } from "../../../../library/api";

interface ExtendedChurchService {
  service_id: number;
  service_name?: string;
  service_type?: string;
  fee?: number;
  form_type?: string | null;
  form_handler?: string;
}
import { CalendarDays, BarChart3, Tags, AlertTriangle, CheckCircle2, Info, XCircle, Calendar, UserCog, UserX, ChevronRight, X, Clock } from "lucide-react";
import SecretaryStatCard from "./components/SecretaryStatCard";
import ModalCloseButton from "./components/ModalCloseButton";
import { ServiceTypeIcon } from "./components/ServiceTypeIcon";
import PriestScheduleModal from "./components/PriestScheduleModal";
import { getFormattedRequestContactNumber, getResidencyLabel, shouldShowNonResidentAddress, getRequestFormAddress } from "./components/requestHelpers";
import { useBookedTimeSlots } from "./hooks/useBookedTimeSlots";
import ServiceDatePicker from "../../../components/booking/ServiceDatePicker";
import { buildTimeOptions, isLongService, isPastTime, timeProblem } from "../../../components/booking/serviceSlots";
import { SecretaryCalendarSkeleton, SecretaryStatSkeleton } from "./components/SecretarySkeletons";
import { priestScheduleAPI, priestSlotFor, timeOffCovers, timeOffShortLabel } from "../../../../library/priestSchedule";
import type { AllPriestTimeOff } from "../../../../library/priestSchedule";

// Define the request details interface
interface RequestDetails {
  contactNumber?: string;
  residency?: string;
  address?: string;
  serviceFee?: number;
  paymentStatus?: string;
  amountPaid?: number;
  assignedPriest?: string;
  assignedPriestId?: number | null;
  createdAt?: string;
  updatedAt?: string;
  childBirthDate?: string;
  motherName?: string;
  fatherName?: string;
  serviceName?: string;
}

interface ScheduledServices {
  id: number;
  type: string;
  name: string;
  date: string;
  time?: string;
  status: RequestStatus;
  displayStatus: string;
  isCompleted?: boolean;
  assignedPriestId?: number | null;
  formHandler?: string;
  requestDetails?: RequestDetails;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  type?: 'danger' | 'warning' | 'info';
}

interface NotificationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

const formatTimeDisplay12Hour = (time: string): string => {
  if (!time) return 'TBA';
  
  const timeMatch = time.match(/(\d{2}):(\d{2})/);
  if (!timeMatch) return time;
  
  const hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  
  if (isNaN(hours) || isNaN(minutes)) return time;
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

const formatDateToYYYYMMDD = (dateString: string): string => {
  if (!dateString) return '';
  
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateString;
  }
};

/** Display-only date (e.g. birth date) — avoids raw ISO like 2021-07-06T16:00:00.000000Z */
const formatDisplayDate = (dateString: string | undefined | null): string => {
  if (!dateString || dateString === 'N/A') return 'N/A';
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
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

const getDisplayStatus = (status: RequestStatus): string => {
  if (status === 'approved') {
    return 'Scheduled';
  }
  if (status === 'done') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'pending') return 'Pending';
  return String(status).charAt(0).toUpperCase() + String(status).slice(1);
};

const mapRequestToScheduledService = (request: ManageRequest): ScheduledServices | null => {
  if (!['approved', 'done'].includes(request.status) || !request.preferred_date) return null;

  const service = request.service as ExtendedChurchService | null | undefined;
  const serviceName = service?.service_name || service?.service_type || '';
  const assignedPriestId = request.assigned_priest ?? request.assignedPriest?.user_id ?? null;
  const formType = request.form_type;
  const formattedDate = formatDateToYYYYMMDD(request.preferred_date);

  const requestDetails: RequestDetails = {
    contactNumber: getFormattedRequestContactNumber(request),
    residency: getResidencyLabel(request.is_resident),
    address: shouldShowNonResidentAddress(
      request.is_resident,
      getRequestFormAddress(request)
    )
      ? getRequestFormAddress(request)
      : undefined,
    serviceFee: request.service?.fee || 0,
    paymentStatus: request.payment_status || 'unpaid',
    amountPaid: request.amount_paid || 0,
    assignedPriest: getUserFullName(request.assignedPriest) || 'Not assigned',
    assignedPriestId,
    createdAt: request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A',
    updatedAt: request.updated_at ? new Date(request.updated_at).toLocaleDateString() : 'N/A',
  };

  const base = {
    id: request.request_id,
    date: formattedDate,
    time: request.preferred_time || 'TBA',
    status: request.status,
    displayStatus: getDisplayStatus(request.status),
    isCompleted: request.status === 'done',
    assignedPriestId,
    formHandler: service?.form_handler,
    requestDetails,
  };

  if (formType === 'baptism' || request.baptismForm || request.baptism_form_id) {
    const childName = request.baptismForm?.child_first_name
      ? `${request.baptismForm.child_first_name} ${request.baptismForm.child_last_name}`
      : getUserFullName(request.user) || 'N/A';
    return {
      ...base,
      type: 'Baptism',
      name: childName,
      requestDetails: {
        ...requestDetails,
        childBirthDate: formatDisplayDate(request.baptismForm?.child_birth_date),
        motherName: request.baptismForm
          ? `${request.baptismForm.mother_first_name} ${request.baptismForm.mother_last_name}`
          : 'N/A',
        fatherName: request.baptismForm
          ? `${request.baptismForm.father_first_name} ${request.baptismForm.father_last_name}`
          : 'N/A',
      },
    };
  }

  if (formType === 'service' || request.serviceForm || request.service_form_id) {
    const formHandler = service?.form_handler || '';
    let serviceType = 'Church Service';

    if (
      serviceName === 'Special Intention' ||
      formHandler === 'special_intention' ||
      serviceName.toLowerCase().includes('special intention')
    ) {
      serviceType = 'Special Intention';
    } else if (serviceName === 'Funeral Mass') {
      serviceType = 'Funeral Mass';
    } else if (serviceName === 'House Blessing') {
      serviceType = 'House Blessing';
    } else if (serviceName === 'Marriage') {
      serviceType = 'Marriage';
    } else if (serviceName) {
      serviceType = serviceName;
    }

    return {
      ...base,
      type: serviceType,
      name: request.serviceForm?.full_name || getUserFullName(request.user) || 'N/A',
      requestDetails: { ...requestDetails, serviceName: serviceName || serviceType },
    };
  }

  if (formType === 'certificate' || request.certificateForm || request.certificate_form_id) {
    const formHandler = (service?.form_handler || '').toLowerCase();
    const rawCertType = (
      request.certificateForm?.certificate_type ||
      request.certificateForm?.certificate_type_label ||
      request.certificateForm?.service_name ||
      serviceName ||
      ''
    )
      .toString()
      .toLowerCase();

    let certType = 'Certificate';
    if (
      formHandler.includes('marriage') ||
      rawCertType.includes('marriage') ||
      serviceName.toLowerCase().includes('marriage')
    ) {
      certType = 'Marriage Certificate';
    } else if (
      formHandler.includes('baptism') ||
      rawCertType.includes('baptism') ||
      serviceName.toLowerCase().includes('baptism')
    ) {
      certType = 'Baptismal Certificate';
    } else if (serviceName) {
      certType = serviceName;
    }

    console.log('[ScheduledServices] Certificate type resolved', {
      requestId: request.request_id,
      formHandler,
      rawCertType,
      serviceName,
      certType,
    });

    return {
      ...base,
      type: certType,
      name: request.certificateForm?.full_name || getUserFullName(request.user) || 'N/A',
      requestDetails: {
        ...requestDetails,
        serviceName: serviceName || certType,
      },
    };
  }

  if (serviceName) {
    return {
      ...base,
      type: serviceName,
      name: getUserFullName(request.user) || 'N/A',
    };
  }

  return null;
};

// ============ MODAL COMPONENTS ============

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch(type) {
      case 'danger': return <AlertTriangle className="text-red-600" size={32} />;
      case 'warning': return <AlertTriangle className="text-amber-600" size={32} />;
      case 'info': return <Info className="text-blue-600" size={32} />;
      default: return <Info className="text-blue-600" size={32} />;
    }
  };

  const getButtonColor = () => {
    switch(type) {
      case 'danger': return 'bg-red-600 hover:bg-red-700';
      case 'warning': return 'bg-amber-600 hover:bg-amber-700';
      case 'info': return 'bg-blue-600 hover:bg-blue-700';
      default: return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {getIcon()}
            <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          </div>
          
          <p className="text-gray-600 leading-relaxed">{message}</p>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm hover:shadow flex items-center gap-2 ${getButtonColor()} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  title,
  message,
  type = 'info',
  onClose
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch(type) {
      case 'success': return <CheckCircle2 className="text-green-600" size={22} aria-hidden />;
      case 'error': return <XCircle className="text-red-600" size={22} aria-hidden />;
      case 'warning': return <AlertTriangle className="text-amber-600" size={22} aria-hidden />;
      case 'info': return <Info className="text-blue-600" size={22} aria-hidden />;
      default: return <Info className="text-blue-600" size={22} aria-hidden />;
    }
  };

  const getIconBackground = () => {
    switch(type) {
      case 'success': return 'bg-green-50';
      case 'error': return 'bg-red-50';
      case 'warning': return 'bg-amber-50';
      case 'info': return 'bg-blue-50';
      default: return 'bg-blue-50';
    }
  };

  const getButtonColor = () => {
    switch(type) {
      case 'success': return 'bg-green-600 hover:bg-green-700';
      case 'error': return 'bg-red-600 hover:bg-red-700';
      case 'warning': return 'bg-amber-600 hover:bg-amber-700';
      case 'info': return 'bg-blue-600 hover:bg-blue-700';
      default: return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getIconBackground()}`}>
              {getIcon()}
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
              <p className="text-gray-600 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm hover:shadow ${getButtonColor()}`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ MAIN COMPONENT ============

const ScheduledServices: React.FC = () => {
  const [allServices, setAllServices] = useState<ScheduledServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [awayData, setAwayData] = useState<AllPriestTimeOff | null>(null);
  const [awayReloadNonce, setAwayReloadNonce] = useState(0);
  const [awaySchedule, setAwaySchedule] = useState<{ priestId: number; name: string; date: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedService, setSelectedService] = useState<ScheduledServices | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  
  // Modal states
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    onConfirm: () => {},
    type: 'warning' as 'danger' | 'warning' | 'info'
  });
  
  const [notificationModal, setNotificationModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info' | 'warning'
  });

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<RescheduleData>({
    preferred_date: '',
    preferred_time: '',
    reschedule_reason: '',
  });
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const { bookedSlots } = useBookedTimeSlots(
    showRescheduleModal ? rescheduleData.preferred_date : '',
    selectedService?.id
  );

  const [showPriestModal, setShowPriestModal] = useState(false);
  const [priests, setPriests] = useState<User[]>([]);
  const [selectedPriestId, setSelectedPriestId] = useState<number | null>(null);
  const [priestsLoading, setPriestsLoading] = useState(false);
  const [priestSubmitting, setPriestSubmitting] = useState(false);

  // Priests who are off at the given date/time come back with `availability_problem` and are shown disabled
  const fetchPriests = useCallback(async (slot: { forDate?: string; forTime?: string } = {}): Promise<User[]> => {
    try {
      console.log('[ScheduledServices] Fetching priests for slot:', slot);
      const response = await usersAPI.listPriests({ activeOnly: true, ...slot });
      if (response.data?.success) {
        const data = response.data.data;
        if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
          return data.data;
        }
        if (Array.isArray(data)) {
          return data;
        }
      }
      return [];
    } catch (error) {
      console.error('Error fetching priests:', error);
      return [];
    }
  }, []);

  const showError = (message: string) => {
    setNotificationModal({
      isOpen: true,
      title: 'Action Failed',
      message,
      type: 'error',
    });
  };

  const showSuccess = (message: string) => {
    setNotificationModal({
      isOpen: true,
      title: 'Success',
      message,
      type: 'success',
    });
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  useEffect(() => {
    let cancelled = false;
    const [y, m] = monthKey.split('-').map(Number);
    const from = `${monthKey}-01`;
    const to = `${monthKey}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    priestScheduleAPI
      .getAllTimeOff(from, to)
      .then((res) => {
        if (cancelled) return;
        console.log('[ScheduledServices] Priest time off for', monthKey, res.data?.data);
        setAwayData(res.data?.data ?? null);
      })
      .catch((err) => {
        if (!cancelled) console.error('[ScheduledServices] Failed to load priest time off:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [monthKey, awayReloadNonce]);

  useEffect(() => {
    if (!showModal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowModal(false);
        setSelectedDate(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showModal]);

  const fetchServices = async () => {
    try {
      setLoading(true);

      const [approvedResponse, doneResponse] = await Promise.all([
        manageRequestAPI.getAll({ status: 'approved', page: 1, per_page: 100 }),
        manageRequestAPI.getAll({ status: 'done', page: 1, per_page: 100 }),
      ]);

      const approvedRequests: ManageRequest[] =
        approvedResponse.data?.success && approvedResponse.data?.data?.data
          ? approvedResponse.data.data.data
          : [];
      const doneRequests: ManageRequest[] =
        doneResponse.data?.success && doneResponse.data?.data?.data
          ? doneResponse.data.data.data
          : [];

      const requests = [...approvedRequests, ...doneRequests];
      console.log('Fetched scheduled services:', {
        approved: approvedRequests.length,
        done: doneRequests.length,
      });

      const services = requests
        .map(mapRequestToScheduledService)
        .filter((service): service is ScheduledServices => service !== null)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setAllServices(services);
    } catch (error) {
      console.error('Error fetching services:', error);
      setError('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsDone = async (serviceId: number) => {
    setConfirmationModal({
      isOpen: true,
      title: 'Mark as Completed',
      message: 'Are you sure you want to mark this service as completed? This action cannot be undone.',
      confirmText: 'Yes, Complete',
      type: 'warning',
      onConfirm: async () => {
        try {
          setActionInProgress(true);
          await manageRequestAPI.complete(serviceId);
          setAllServices((prevServices) =>
            prevServices.map((service) =>
              service.id === serviceId
                ? {
                    ...service,
                    status: 'done',
                    displayStatus: 'Completed',
                    isCompleted: true,
                  }
                : service
            )
          );
          setShowDetailModal(false);
          setSelectedService(null);
          
          setNotificationModal({
            isOpen: true,
            title: 'Service Completed',
            message: 'The service has been successfully marked as completed.',
            type: 'success'
          });
          
          console.log('Service marked as completed successfully');
        } catch (error) {
          console.error('Error marking service as done:', error);
          
          setNotificationModal({
            isOpen: true,
            title: 'Action Failed',
            message: 'Failed to mark service as completed. Please try again.',
            type: 'error'
          });
        } finally {
          setActionInProgress(false);
          setConfirmationModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleReschedule = () => {
    if (!selectedService) return;

    let timeValue = selectedService.time || '';
    const timeMatch = timeValue.match(/(\d{2}):(\d{2})/);
    if (timeMatch) {
      timeValue = timeMatch[0];
    }

    setRescheduleData({
      preferred_date: selectedService.date,
      preferred_time: timeValue === 'TBA' ? '' : timeValue,
      reschedule_reason: '',
    });
    setShowRescheduleModal(true);
  };

  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setRescheduleData({
      preferred_date: '',
      preferred_time: '',
      reschedule_reason: '',
    });
  };

  const submitReschedule = async () => {
    if (!selectedService) return;

    if (!rescheduleData.preferred_date || !rescheduleData.preferred_time) {
      showError('Please select a new date and time.');
      return;
    }

    const slotIssue = timeProblem(
      rescheduleData.preferred_date,
      rescheduleData.preferred_time,
      bookedSlots,
      true,
      isLongService(selectedService.formHandler),
    );
    if (slotIssue) {
      console.warn('[ScheduledServices] Reschedule slot rejected', { ...rescheduleData, slotIssue });
      showError(slotIssue);
      return;
    }

    if (!rescheduleData.reschedule_reason || rescheduleData.reschedule_reason.trim().length < 10) {
      showError('Please provide a reschedule reason (at least 10 characters).');
      return;
    }

    setRescheduleSubmitting(true);
    try {
      console.log('Rescheduling service:', selectedService.id, rescheduleData);
      await manageRequestAPI.reschedule(selectedService.id, rescheduleData);
      closeRescheduleModal();
      setShowDetailModal(false);
      setSelectedService(null);
      await fetchServices();
      showSuccess('Service rescheduled successfully. The calendar has been updated.');
    } catch (error) {
      console.error('Reschedule error:', error);
      showError(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to reschedule service.'
          : 'Failed to reschedule service.'
      );
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const handleChangePriest = async () => {
    if (!selectedService) return;

    setShowPriestModal(true);
    setPriestsLoading(true);

    const isCertificate = selectedService.type.toLowerCase().includes('certificate');
    const priestList = await fetchPriests(
      isCertificate ? {} : priestSlotFor(selectedService.date, selectedService.time === 'TBA' ? null : selectedService.time)
    );
    setPriests(priestList);

    const currentId =
      selectedService.requestDetails?.assignedPriestId ??
      selectedService.assignedPriestId ??
      null;
    const currentInList =
      currentId !== null &&
      priestList.some((priest) => priest.user_id === currentId && !priest.availability_problem);
    setSelectedPriestId(currentInList ? currentId : null);
    setPriestsLoading(false);
  };

  const closePriestModal = () => {
    setShowPriestModal(false);
    setSelectedPriestId(null);
    setPriests([]);
  };

  const submitChangePriest = async () => {
    if (!selectedService || !selectedPriestId) {
      showError('Please select a priest.');
      return;
    }

    setPriestSubmitting(true);
    try {
      console.log('Changing priest for service:', selectedService.id, selectedPriestId);
      await manageRequestAPI.assignPriest(selectedService.id, selectedPriestId);

      const priest = priests.find((p) => p.user_id === selectedPriestId);
      const priestName = priest ? getUserFullName(priest) : 'Assigned';

      setSelectedService((prev) =>
        prev
          ? {
              ...prev,
              assignedPriestId: selectedPriestId,
              requestDetails: {
                ...prev.requestDetails,
                assignedPriest: priestName,
                assignedPriestId: selectedPriestId,
              },
            }
          : prev
      );

      setAllServices((prev) =>
        prev.map((service) =>
          service.id === selectedService.id
            ? {
                ...service,
                assignedPriestId: selectedPriestId,
                requestDetails: {
                  ...service.requestDetails,
                  assignedPriest: priestName,
                  assignedPriestId: selectedPriestId,
                },
              }
            : service
        )
      );

      closePriestModal();
      showSuccess('Assigned priest updated successfully.');
    } catch (error) {
      console.error('Change priest error:', error);
      showError(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to change assigned priest.'
          : 'Failed to change assigned priest.'
      );
    } finally {
      setPriestSubmitting(false);
    }
  };

  const handleViewDetails = (service: ScheduledServices) => {
    setSelectedService(service);
    setShowDetailModal(true);
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const changeMonth = (increment: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + increment);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(null);
  };

  const getServicesForDate = (dateString: string) => {
    return allServices.filter(service => service.date === dateString);
  };

  const getPriestsAwayOn = (dateKey: string): { key: string; priestId: number; name: string; text: string }[] => {
    if (!awayData) return [];
    const away = awayData.time_off
      .filter((entry) => timeOffCovers(entry, dateKey))
      .map((entry) => {
        const label = timeOffShortLabel(entry);
        const name = entry.priest_name ?? 'Unknown';
        return {
          key: `entry-${entry.time_off_id}`,
          priestId: entry.priest_id,
          name,
          text: `Fr. ${name} ${label === 'Off' ? 'away' : label.replace('Off', 'off')}`,
        };
      });
    const todayKey = formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    if (dateKey >= todayKey) {
      awayData.switched_off.forEach((p) => {
        if (!p.unavailable_until || dateKey <= p.unavailable_until.slice(0, 10)) {
          away.push({
            key: `switch-${p.priest_id}`,
            priestId: p.priest_id,
            name: p.priest_name,
            text: `Fr. ${p.priest_name} unavailable`,
          });
        }
      });
    }
    return away;
  };

  const openAwaySchedule = (priestId: number, name: string, date: string) => {
    console.log('[ScheduledServices] Opening priest schedule', { priestId, date });
    setShowModal(false);
    setAwaySchedule({ priestId, name, date });
  };

  const closeAwaySchedule = () => {
    setAwaySchedule(null);
    setShowModal(true);
  };

  const formatDateKey = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isToday = (year: number, month: number, day: number) => {
    const today = new Date();
    return year === today.getFullYear() && 
           month === today.getMonth() && 
           day === today.getDate();
  };

  const handleDateClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedDate(null);
  };

  // ============ RENDER COMPONENTS ============

  const renderStats = () => {
    const completedCount = allServices.filter((service) => service.status === 'done').length;
    const scheduledCount = allServices.filter((service) => service.status === 'approved').length;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <SecretaryStatCard icon={BarChart3} label="Total on Calendar" value={allServices.length} />
        <SecretaryStatCard icon={CalendarDays} label="Scheduled" value={scheduledCount} />
        <SecretaryStatCard icon={CheckCircle2} label="Completed" value={completedCount} />
        <SecretaryStatCard icon={Tags} label="Service Types" value={new Set(allServices.map((s) => s.type)).size} />
      </div>
    );
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const cells = [];

    weekdays.forEach((day) => {
      cells.push(
        <div key={`header-${day}`} className="text-center text-xs font-semibold text-gray-500 py-3 bg-gray-50">
          {day}
        </div>
      );
    });

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="h-20 sm:h-24 border-t border-l border-gray-100 bg-gray-50/40" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(year, month, day);
      const servicesOnDay = getServicesForDate(dateKey);
      const isTodayDate = isToday(year, month, day);
      const hasServices = servicesOnDay.length > 0;
      const allCompleted = hasServices && servicesOnDay.every((service) => service.status === 'done');
      const priestsAway = getPriestsAwayOn(dateKey);
      const isClickable = hasServices || priestsAway.length > 0;
      const countLabel = `${servicesOnDay.length} service${servicesOnDay.length === 1 ? '' : 's'}`;
      const StatusIcon = allCompleted ? CheckCircle2 : CalendarDays;

      cells.push(
        <button
          type="button"
          key={`day-${day}`}
          disabled={!isClickable}
          onClick={() => handleDateClick(dateKey)}
          aria-label={`${dateKey}: ${hasServices ? countLabel : 'no services'}${priestsAway.length ? `, ${priestsAway.length} priest away` : ''}`}
          className={`flex h-20 sm:h-24 flex-col items-start justify-between border-t border-l border-gray-100 p-1.5 sm:p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
            isClickable ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
          }`}
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums ${
              isTodayDate
                ? 'bg-blue-600 font-semibold text-white'
                : hasServices
                ? 'font-semibold text-gray-900'
                : 'text-gray-500'
            }`}
          >
            {day}
          </span>

          <span className="flex w-full items-center justify-between gap-1">
            {hasServices ? (
              <span
                title={countLabel}
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                  allCompleted ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                }`}
              >
                <StatusIcon size={13} aria-hidden />
                {servicesOnDay.length}
              </span>
            ) : (
              <span />
            )}
            {priestsAway.length > 0 && (
              <span title={priestsAway.map((p) => p.text).join('\n')} className="text-amber-600">
                <UserX size={14} aria-hidden />
              </span>
            )}
          </span>
        </button>
      );
    }

    return cells;
  };

  const renderModal = () => {
    if (!showModal || !selectedDate) return null;

    const timeKey = (service: ScheduledServices) => service.time?.match(/\d{2}:\d{2}/)?.[0] ?? '99:99';
    const servicesOnDate = [...getServicesForDate(selectedDate)].sort((a, b) => timeKey(a).localeCompare(timeKey(b)));
    const priestsAway = getPriestsAwayOn(selectedDate);
    const completedCount = servicesOnDate.filter((service) => service.status === 'done' || service.isCompleted).length;
    const scheduledCount = servicesOnDate.length - completedCount;
    const formattedDate = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const summary = servicesOnDate.length === 0
      ? 'No services on this date'
      : [
          `${servicesOnDate.length} service${servicesOnDate.length === 1 ? '' : 's'}`,
          scheduledCount > 0 ? `${scheduledCount} scheduled` : '',
          completedCount > 0 ? `${completedCount} completed` : '',
        ].filter(Boolean).join(' · ');

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={closeModal}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Services on ${formattedDate}`}
          onClick={(event) => event.stopPropagation()}
          className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{formattedDate}</h3>
              <p className="mt-0.5 text-sm text-gray-500">{summary}</p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={20} aria-hidden />
            </button>
          </div>

          {priestsAway.length > 0 && (
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
              <p className="mb-2 text-xs font-medium text-amber-900">Priest day off. Select a priest to view their schedule.</p>
              <div className="flex flex-wrap gap-2">
                {priestsAway.map((priest) => (
                  <button
                    key={priest.key}
                    type="button"
                    onClick={() => openAwaySchedule(priest.priestId, priest.name, selectedDate)}
                    aria-label={`View schedule of Fr. ${priest.name}`}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-left text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <UserX size={15} className="shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{priest.text}</span>
                    <ChevronRight size={15} className="shrink-0" aria-hidden />
                  </button>
                ))}
              </div>
            </div>
          )}

          <ul className="divide-y divide-gray-100 overflow-y-auto">
            {servicesOnDate.map((service) => {
              const isCompleted = service.status === 'done' || service.isCompleted;

              return (
                <li key={service.id}>
                  <button
                    type="button"
                    onClick={() => {
                      closeModal();
                      handleViewDetails(service);
                    }}
                    aria-label={`View details: ${service.type}, ${service.name}`}
                    className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                  >
                    <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                      {formatTimeDisplay12Hour(service.time || '')}
                    </span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <ServiceTypeIcon serviceName={service.type} size={18} className="text-slate-600" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-900">{service.type}</span>
                      <span className="block truncate text-sm text-gray-500">{service.name}</span>
                    </span>
                    <span
                      className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-block ${
                        isCompleted ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {service.displayStatus}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-gray-400 group-hover:text-gray-600" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  };

const renderDetailModal = () => {
    if (!showDetailModal || !selectedService) return null;

    const details = selectedService.requestDetails;
    const isCompleted = selectedService.status === 'done' || selectedService.isCompleted;
    const scheduledHm = selectedService.time?.match(/\d{2}:\d{2}/)?.[0] ?? '00:00';
    const canComplete = isPastTime(selectedService.date, scheduledHm);
    const scheduledDate = new Date(`${selectedService.date}T00:00:00`);
    const completeFromLabel = scheduledDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const shortDate = scheduledDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeLabel = formatTimeDisplay12Hour(selectedService.time || '');
    const paymentStatus = (details?.paymentStatus || '').toLowerCase();
    const paymentLabel = paymentStatus ? paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1) : 'N/A';
    const paymentTone =
      paymentStatus === 'paid'
        ? 'bg-green-50 text-green-700'
        : paymentStatus === 'partial'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-slate-100 text-slate-700';
    const formatPeso = (amount?: number) => `₱${(amount || 0).toLocaleString("en-PH")}`;

    const closeDetails = () => {
      setShowDetailModal(false);
      setSelectedService(null);
    };

    const renderSection = (title: string, rows: Array<[string, React.ReactNode]>) => (
      <section className="min-w-0">
        <h4 className="mb-2 text-sm font-semibold text-slate-900">{title}</h4>
        <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 px-4 py-2.5">
              <dt className="shrink-0 text-sm text-slate-500">{label}</dt>
              <dd className="min-w-0 break-words text-right text-sm font-medium text-slate-900">{value || 'N/A'}</dd>
            </div>
          ))}
        </dl>
      </section>
    );

    const clientRows: Array<[string, React.ReactNode]> = [
      ['Contact', details?.contactNumber],
      ['Residency', details?.residency || 'Resident'],
    ];
    if (details?.address) clientRows.push(['Address', details.address]);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedService.type} details`}
          className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="flex items-start gap-3 px-6 pb-4 pt-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <ServiceTypeIcon serviceName={selectedService.type} size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-slate-900">{selectedService.type}</h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isCompleted ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {selectedService.displayStatus}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-slate-600">{selectedService.name}</p>
            </div>
            <button
              type="button"
              onClick={closeDetails}
              aria-label="Close"
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={20} aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 border-y border-slate-200 bg-slate-50 px-6 py-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Calendar size={16} className="shrink-0 text-slate-500" aria-hidden />
              {shortDate}
            </div>
            <div className="flex items-center gap-2 text-sm font-medium tabular-nums text-slate-900">
              <Clock size={16} className="shrink-0 text-slate-500" aria-hidden />
              {timeLabel}
            </div>
            <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-900" title={details?.assignedPriest}>
              <UserCog size={16} className="shrink-0 text-slate-500" aria-hidden />
              <span className="truncate">{details?.assignedPriest || 'Not assigned'}</span>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {details && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {renderSection('Client', clientRows)}
                {renderSection('Payment', [
                  ['Service fee', <span className="tabular-nums">{formatPeso(details.serviceFee)}</span>],
                  ['Amount paid', <span className="tabular-nums">{formatPeso(details.amountPaid)}</span>],
                  ['Status', <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentTone}`}>{paymentLabel}</span>],
                ])}
              </div>
            )}

            {details?.childBirthDate &&
              renderSection('Baptism', [
                ["Child's birth date", details.childBirthDate],
                ["Mother's name", details.motherName],
                ["Father's name", details.fatherName],
              ])}

            {details && (
              <p className="text-xs text-slate-500">
                Created {details.createdAt} · Last updated {details.updatedAt}
              </p>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4">
            {isCompleted ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-sm text-green-800">
                  <CheckCircle2 size={16} className="shrink-0 text-green-600" aria-hidden />
                  Completed and kept on the calendar for record keeping.
                </p>
                <button
                  type="button"
                  onClick={closeDetails}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {!canComplete && (
                  <p className="mb-3 flex items-center gap-2 text-sm text-slate-600">
                    <Info size={16} className="shrink-0 text-blue-600" aria-hidden />
                    You can mark this as completed starting {completeFromLabel} at {timeLabel}.
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleReschedule}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <Calendar size={16} aria-hidden />
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={handleChangePriest}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <UserCog size={16} aria-hidden />
                      Change Priest
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMarkAsDone(selectedService.id)}
                    disabled={actionInProgress || !canComplete}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
                      canComplete ? 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-60' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {actionInProgress ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} aria-hidden />
                        Mark as Completed
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

// ============ MAIN RENDER ============

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — always visible while data loads */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays size={28} className="text-blue-600" />
                Scheduled Services
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage scheduled and completed services. Completed events stay on the calendar in green.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                {`${allServices.length} service${allServices.length !== 1 ? 's' : ''} scheduled`}
              </span>
              <button
                onClick={goToToday}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow"
              >
                Today
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content — calendar UI renders immediately; events fill in when API returns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <div className="flex justify-center items-center h-80">
            <div className="text-center bg-red-50 p-8 rounded-xl border border-red-200 max-w-md">
              <AlertTriangle size={40} className="text-red-500 mx-auto mb-3" />
              <p className="text-red-600 font-medium">{error}</p>
              <button
                onClick={fetchServices}
                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <>
            {loading && allServices.length === 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <SecretaryStatSkeleton key={`sched-stat-skel-${index}`} />
                  ))}
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                  <div className="h-6 w-48 mx-auto rounded bg-slate-200 animate-pulse" />
                </div>
                <SecretaryCalendarSkeleton />
              </>
            ) : (
              <>
            {renderStats()}

            {/* Calendar Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => changeMonth(-1)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-xl font-bold text-gray-800">
                  {currentMonth.toLocaleString('default', { month: 'long' })} {currentMonth.getFullYear()}
                </h2>
                <button
                  onClick={() => changeMonth(1)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
              <div className="grid grid-cols-7 gap-0">
                {renderCalendar()}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-gray-100 px-4 py-3 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} className="text-blue-700" aria-hidden />Has scheduled services</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} className="text-green-700" aria-hidden />All completed</span>
                <span className="inline-flex items-center gap-1.5"><UserX size={13} className="text-amber-600" aria-hidden />Priest away</span>
              </div>
            </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {renderModal()}
      {renderDetailModal()}
      {awaySchedule && (
        <PriestScheduleModal
          priestId={awaySchedule.priestId}
          priestName={awaySchedule.name}
          initialDate={awaySchedule.date}
          onClose={closeAwaySchedule}
          onChanged={() => setAwayReloadNonce((n) => n + 1)}
        />
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedService && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800">Reschedule Service</h3>
              <ModalCloseButton onClick={closeRescheduleModal} />
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600">
                  <span className="font-medium">{selectedService.type}</span> — {selectedService.name}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Date *</label>
                <ServiceDatePicker
                  ariaLabel="New date"
                  value={rescheduleData.preferred_date}
                  onChange={(date) => setRescheduleData({ ...rescheduleData, preferred_date: date, preferred_time: '' })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Time *</label>
                <select
                  value={rescheduleData.preferred_time}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, preferred_time: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">{rescheduleData.preferred_date ? 'Select time' : 'Pick a date first'}</option>
                  {buildTimeOptions(rescheduleData.preferred_date, bookedSlots, true, isLongService(selectedService?.formHandler)).map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                      {option.display}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
                <textarea
                  value={rescheduleData.reschedule_reason}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, reschedule_reason: e.target.value })}
                  placeholder="Explain why this service is being rescheduled..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">Minimum 10 characters. Conflicts with other schedules are blocked.</p>
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
                onClick={submitReschedule}
                disabled={rescheduleSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {rescheduleSubmitting ? 'Processing...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Priest Modal */}
      {showPriestModal && selectedService && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Change Assigned Priest</h3>
              <ModalCloseButton onClick={closePriestModal} />
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1">
                <p><span className="font-medium">Service:</span> {selectedService.type}</p>
                <p><span className="font-medium">Name:</span> {selectedService.name}</p>
                <p><span className="font-medium">Current Priest:</span> {selectedService.requestDetails?.assignedPriest || 'Not assigned'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Priest *</label>
                {priestsLoading ? (
                  <div className="flex items-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    <span className="ml-2 text-sm text-slate-500">Loading priests...</span>
                  </div>
                ) : priests.length === 0 ? (
                  <p className="text-sm text-amber-600">No active priests found.</p>
                ) : (
                  <>
                    <select
                      value={selectedPriestId || ''}
                      onChange={(e) => setSelectedPriestId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select a priest...</option>
                      {priests.map((priest) => (
                        <option
                          key={priest.user_id}
                          value={priest.user_id}
                          disabled={!!priest.availability_problem}
                          title={priest.availability_problem || undefined}
                        >
                          {getUserFullName(priest)}
                          {priest.availability_problem ? ' — unavailable at this time' : ''}
                        </option>
                      ))}
                    </select>
                    {priests.some((p) => p.availability_problem) && (
                      <ul className="mt-2 space-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {priests.filter((p) => p.availability_problem).map((p) => (
                          <li key={p.user_id}>{p.availability_problem}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={closePriestModal}
                disabled={priestSubmitting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submitChangePriest}
                disabled={
                  priestSubmitting ||
                  priestsLoading ||
                  !selectedPriestId ||
                  priests.length === 0 ||
                  !!priests.find((p) => p.user_id === selectedPriestId)?.availability_problem
                }
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
              >
                {priestSubmitting ? 'Saving...' : 'Save Priest'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        confirmText={confirmationModal.confirmText}
        cancelText="Cancel"
        onConfirm={confirmationModal.onConfirm}
        onCancel={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
        isLoading={actionInProgress}
        type={confirmationModal.type}
      />

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notificationModal.isOpen}
        title={notificationModal.title}
        message={notificationModal.message}
        type={notificationModal.type}
        onClose={() => setNotificationModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Add animation keyframes */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ScheduledServices;