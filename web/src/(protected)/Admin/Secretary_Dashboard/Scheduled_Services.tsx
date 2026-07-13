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
}
import { CalendarDays, BarChart3, Tags, AlertTriangle, CheckCircle2, Info, XCircle, ClipboardList, Zap, Calendar, UserCog } from "lucide-react";
import SecretaryStatCard from "./components/SecretaryStatCard";
import ModalCloseButton from "./components/ModalCloseButton";
import { ServiceTypeIcon } from "./components/ServiceTypeIcon";

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

// Define the request details interface
interface RequestDetails {
  contactNumber?: string;
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
  certificateType?: string;
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
    contactNumber: request.user?.contact_number || request.user?.email || 'N/A',
    address: request.serviceForm?.address || request.baptismForm?.address || request.certificateForm?.address || 'N/A',
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
        childBirthDate: request.baptismForm?.child_birth_date || 'N/A',
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
    let serviceType = 'Church Service';
    if (serviceName === 'Funeral Mass') serviceType = 'Funeral Mass';
    else if (serviceName === 'House Blessing') serviceType = 'House Blessing';
    else if (serviceName === 'Marriage') serviceType = 'Marriage';

    return {
      ...base,
      type: serviceType,
      name: request.serviceForm?.full_name || getUserFullName(request.user) || 'N/A',
      requestDetails: { ...requestDetails, serviceName },
    };
  }

  if (formType === 'certificate' || request.certificateForm || request.certificate_form_id) {
    const certType =
      request.certificateForm?.certificate_type === 'marriage'
        ? 'Marriage Certificate'
        : 'Baptismal Certificate';
    return {
      ...base,
      type: certType,
      name: request.certificateForm?.full_name || getUserFullName(request.user) || 'N/A',
      requestDetails: {
        ...requestDetails,
        certificateType: request.certificateForm?.certificate_type || 'N/A',
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
      case 'success': return <CheckCircle2 className="text-blue-600" size={32} />;
      case 'error': return <XCircle className="text-red-600" size={32} />;
      case 'warning': return <AlertTriangle className="text-amber-600" size={32} />;
      case 'info': return <Info className="text-blue-600" size={32} />;
      default: return <Info className="text-blue-600" size={32} />;
    }
  };

  const getBorderColor = () => {
    switch(type) {
      case 'success': return 'border-green-500 bg-green-50';
      case 'error': return 'border-red-500 bg-red-50';
      case 'warning': return 'border-amber-500 bg-amber-50';
      case 'info': return 'border-blue-500 bg-blue-50';
      default: return 'border-blue-500 bg-blue-50';
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
      <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-l-4 ${getBorderColor()}`}>
        <div className="p-6">
          <div className="flex items-start gap-3">
            <span className="text-3xl">{getIcon()}</span>
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

  const [showPriestModal, setShowPriestModal] = useState(false);
  const [priests, setPriests] = useState<User[]>([]);
  const [selectedPriestId, setSelectedPriestId] = useState<number | null>(null);
  const [priestsLoading, setPriestsLoading] = useState(false);
  const [priestSubmitting, setPriestSubmitting] = useState(false);

  const fetchPriests = useCallback(async (): Promise<User[]> => {
    try {
      const response = await usersAPI.listPriests({ activeOnly: true, availableOnly: true });
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

    const priestList = await fetchPriests();
    setPriests(priestList);

    const currentId =
      selectedService.requestDetails?.assignedPriestId ??
      selectedService.assignedPriestId ??
      null;
    const currentInList =
      currentId !== null && priestList.some((priest) => priest.user_id === currentId);
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

  const formatDateKey = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isToday = (year: number, month: number, day: number) => {
    const today = new Date();
    return year === today.getFullYear() && 
           month === today.getMonth() && 
           day === today.getDate();
  };

  const getServiceColor = (service: ScheduledServices) => {
    if (service.status === 'done' || service.isCompleted) {
      return 'bg-green-50 border-green-400 text-green-800';
    }
    return 'bg-blue-50 border-blue-300 text-blue-800';
  };

  const getDayBadgeColor = (servicesOnDay: ScheduledServices[]) => {
    const allCompleted = servicesOnDay.every((service) => service.status === 'done');
    return allCompleted ? 'bg-green-500' : 'bg-blue-500';
  };

  const handleDateClick = (dateKey: string) => {
    const servicesOnDate = getServicesForDate(dateKey);
    if (servicesOnDate.length > 0) {
      setSelectedDate(dateKey);
      setShowModal(true);
    }
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
      cells.push(<div key={`empty-${i}`} className="h-28 bg-gray-50/30" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(year, month, day);
      const servicesOnDay = getServicesForDate(dateKey);
      const isTodayDate = isToday(year, month, day);
      const hasServices = servicesOnDay.length > 0;
      const allCompleted = hasServices && servicesOnDay.every((service) => service.status === 'done');

      cells.push(
        <div
          key={`day-${day}`}
          onClick={() => hasServices && handleDateClick(dateKey)}
          className={`
            h-28 border border-gray-100 p-1.5 transition-all duration-200
            ${hasServices 
              ? allCompleted
                ? 'cursor-pointer hover:bg-green-50 hover:shadow-inner hover:scale-[1.02] hover:z-10 relative'
                : 'cursor-pointer hover:bg-blue-50 hover:shadow-inner hover:scale-[1.02] hover:z-10 relative'
              : 'bg-gray-50/30 cursor-default opacity-60'}
            ${isTodayDate ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
            ${selectedDate === dateKey ? (allCompleted ? 'bg-green-100 ring-2 ring-green-400' : 'bg-blue-100 ring-2 ring-blue-400') : ''}
          `}
        >
          <div className="flex justify-between items-start">
            <span className={`
              text-sm font-medium px-2 py-0.5 rounded-full
              ${isTodayDate ? 'bg-blue-500 text-white' : hasServices ? 'text-gray-800' : 'text-gray-400'}
            `}>
              {day}
            </span>
            {hasServices && (
              <span className={`px-2 py-0.5 text-[10px] font-semibold text-white rounded-full shadow-sm ${getDayBadgeColor(servicesOnDay)}`}>
                {servicesOnDay.length}
              </span>
            )}
          </div>
          
          {hasServices && (
            <div className="mt-1.5 space-y-0.5">
              {servicesOnDay.slice(0, 2).map((service, idx) => (
                <div 
                  key={idx}
                  className={`text-[10px] truncate px-1.5 py-0.5 rounded border-l-2 ${getServiceColor(service)}`}
                  title={service.name}
                >
                  <span className="mr-0.5 inline-flex align-middle">
                    <ServiceTypeIcon serviceName={service.type} size={12} />
                  </span>
                  {service.name}
                </div>
              ))}
              {servicesOnDay.length > 2 && (
                <div className="text-[10px] text-blue-600 font-semibold px-1.5">
                  +{servicesOnDay.length - 2} more
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return cells;
  };

  const renderModal = () => {
    if (!showModal || !selectedDate) return null;

    const servicesOnDate = getServicesForDate(selectedDate);
    const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-blue-50">
            <div>
              <h3 className="text-xl font-bold text-gray-800">{formattedDate}</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {servicesOnDate.length} service{servicesOnDate.length > 1 ? 's' : ''} scheduled
              </p>
            </div>
            <button
              onClick={closeModal}
              className="p-2 hover:bg-white/60 rounded-xl transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="space-y-3">
              {servicesOnDate.map((service) => {
                const isCompleted = service.status === 'done' || service.isCompleted;

                return (
                <div 
                  key={service.id} 
                  className={`flex items-center justify-between p-4 rounded-xl transition-all duration-200 border hover:shadow-md hover:scale-[1.01] ${
                    isCompleted
                      ? 'bg-green-50/70 border-green-200'
                      : 'bg-blue-50/50 border-blue-100'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <ServiceTypeIcon serviceName={service.type} size={28} />
                    <div>
                      <div className="font-semibold text-gray-800">{service.type}</div>
                      <div className="text-sm text-gray-600">{service.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700">
                        {formatTimeDisplay12Hour(service.time || '')}
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                      isCompleted
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-blue-100 text-blue-700 border-blue-200'
                    }`}>
                      {service.displayStatus}
                    </span>
                    <button
                      onClick={() => {
                        closeModal();
                        handleViewDetails(service);
                      }}
                      className={`px-4 py-1.5 text-xs font-medium text-white rounded-lg transition-colors shadow-sm hover:shadow ${
                        isCompleted ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
              })}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
            <button
              onClick={closeModal}
              className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailModal = () => {
    if (!showDetailModal || !selectedService) return null;

    const details = selectedService.requestDetails;
    const isCompleted = selectedService.status === 'done' || selectedService.isCompleted;

    const DetailField = ({ label, value }: { label: string; value?: string | number }) => (
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
        <p className="text-sm text-gray-800 mt-0.5 font-medium">{value || 'N/A'}</p>
      </div>
    );

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-indigo-50">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Service Details</h3>
              <p className="text-sm text-gray-600 mt-0.5">Complete request information</p>
            </div>
            <button
              onClick={() => {
                setShowDetailModal(false);
                setSelectedService(null);
              }}
              className="p-2 hover:bg-white/60 rounded-xl transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Service Type</label>
                  <p className="text-lg font-bold text-gray-800 flex items-center gap-2 mt-0.5">
                    <ServiceTypeIcon serviceName={selectedService.type} size={18} />
                    {selectedService.type}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                  <span className={`inline-block mt-1 px-3 py-1 text-sm font-semibold rounded-full border ${
                    isCompleted
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-blue-100 text-blue-700 border-blue-200'
                  }`}>
                    {selectedService.displayStatus}
                  </span>
                </div>
                <DetailField label="Name" value={selectedService.name} />
                <DetailField 
                  label="Date" 
                  value={new Date(selectedService.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })} 
                />
                <DetailField label="Time" value={formatTimeDisplay12Hour(selectedService.time || '')} />
              </div>

              {/* Request Details */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <ClipboardList size={16} className="text-blue-600" /> Complete Request Details
                </h4>
                <div className="grid grid-cols-2 gap-5 bg-gray-50 p-5 rounded-xl border border-gray-200">
                  {details && (
                    <>
                      <DetailField label="Contact Number" value={details.contactNumber} />
                      <DetailField label="Address" value={details.address} />
                      <DetailField label="Assigned Priest" value={details.assignedPriest} />
                      <DetailField label="Service Fee" value={details.serviceFee ? `₱${details.serviceFee.toLocaleString()}` : '₱0'} />
                      <DetailField label="Payment Status" value={details.paymentStatus ? details.paymentStatus.charAt(0).toUpperCase() + details.paymentStatus.slice(1) : 'N/A'} />
                      <DetailField label="Amount Paid" value={details.amountPaid ? `₱${details.amountPaid.toLocaleString()}` : '₱0'} />
                      <DetailField label="Created" value={details.createdAt} />
                      <DetailField label="Last Updated" value={details.updatedAt} />
                      
                      {details.childBirthDate && (
                        <>
                          <DetailField label="Child's Birth Date" value={details.childBirthDate} />
                          <DetailField label="Mother's Name" value={details.motherName} />
                          <DetailField label="Father's Name" value={details.fatherName} />
                        </>
                      )}
                      
                      {details.certificateType && (
                        <DetailField label="Certificate Type" value={details.certificateType} />
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              {!isCompleted && (
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Zap size={16} className="text-blue-600" /> Actions
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => handleMarkAsDone(selectedService.id)}
                    disabled={actionInProgress}
                    className="px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow"
                  >
                    {actionInProgress ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        Mark as Completed
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleReschedule}
                    className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow"
                  >
                    <Calendar size={18} />
                    Reschedule
                  </button>

                  <button
                    onClick={handleChangePriest}
                    className="px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow"
                  >
                    <UserCog size={18} />
                    Change Priest
                  </button>
                </div>
              </div>
              )}

              {isCompleted && (
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle2 size={20} className="text-green-600" />
                    <p className="text-sm text-green-800 font-medium">
                      This service has been completed and is kept on the calendar for record keeping.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
            <button
              onClick={() => {
                setShowDetailModal(false);
                setSelectedService(null);
              }}
              className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============ MAIN RENDER ============

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading scheduled services...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-96">
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
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
                {allServices.length} service{allServices.length > 1 ? 's' : ''} scheduled
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 gap-0">
            {renderCalendar()}
          </div>
        </div>
      </div>

      {/* Modals */}
      {renderModal()}
      {renderDetailModal()}

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
                <input
                  type="date"
                  value={rescheduleData.preferred_date}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, preferred_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Time *</label>
                <select
                  value={rescheduleData.preferred_time}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, preferred_time: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                  <p className="text-sm text-amber-600">No available priests right now. Priests marked unavailable are hidden from this list.</p>
                ) : (
                  <select
                    value={selectedPriestId || ''}
                    onChange={(e) => setSelectedPriestId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select a priest...</option>
                    {priests.map((priest) => (
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
                onClick={closePriestModal}
                disabled={priestSubmitting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submitChangePriest}
                disabled={priestSubmitting || priestsLoading || !selectedPriestId || priests.length === 0}
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