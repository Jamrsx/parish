import React, { useState, useEffect } from "react";
import { manageRequestAPI, getStatusLabel } from "../../../../library/manage-request";
import type { RequestStatus, ManageRequest } from "../../../../library/manage-request";
import type { User } from "../../../../library/api";

// Define the request details interface
interface RequestDetails {
  contactNumber?: string;
  address?: string;
  serviceFee?: number;
  paymentStatus?: string;
  amountPaid?: number;
  assignedPriest?: string;
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
  return getStatusLabel(status);
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
      case 'danger': return '⚠️';
      case 'warning': return '⚡';
      case 'info': return 'ℹ️';
      default: return '❓';
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
            <span className="text-4xl">{getIcon()}</span>
            <h3 className="text-xl font-bold text-gray-800">{title}</h3>
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
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
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

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      
      const response = await manageRequestAPI.getAll({ page: 1, per_page: 50 });

      if (response.data?.success && response.data?.data?.data) {
        const requests: ManageRequest[] = response.data.data.data;  
        
        const services: ScheduledServices[] = [];
        
        requests.forEach((request: ManageRequest) => {
          if (request.status === 'approved' && request.preferred_date) {
            const serviceName = request.service?.service_name || '';
            const formType = request.form_type;
            let service: ScheduledServices | null = null;
            
            const formattedDate = formatDateToYYYYMMDD(request.preferred_date);
            
            const requestDetails: RequestDetails = {
              contactNumber: request.user?.contact_number || request.user?.email || 'N/A',
              address: request.serviceForm?.address || request.baptismForm?.address || request.certificateForm?.address || 'N/A',
              serviceFee: request.service?.fee || 0,
              paymentStatus: request.payment_status || 'unpaid',
              amountPaid: request.amount_paid || 0,
              assignedPriest: getUserFullName(request.assignedPriest) || 'Not assigned',
              createdAt: request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A',
              updatedAt: request.updated_at ? new Date(request.updated_at).toLocaleDateString() : 'N/A',
            };
            
            if (formType === 'baptism' || request.baptismForm || request.baptism_form_id) {
              const childName = request.baptismForm?.child_first_name 
                ? `${request.baptismForm.child_first_name} ${request.baptismForm.child_last_name}` 
                : getUserFullName(request.user) || 'N/A';
              service = {
                id: request.request_id,
                type: 'Baptism',
                name: childName,
                date: formattedDate,
                time: request.preferred_time || 'TBA',
                status: request.status,
                displayStatus: getDisplayStatus(request.status),
                isCompleted: false,
                requestDetails: {
                  ...requestDetails,
                  childBirthDate: request.baptismForm?.child_birth_date || 'N/A',
                  motherName: request.baptismForm ? `${request.baptismForm.mother_first_name} ${request.baptismForm.mother_last_name}` : 'N/A',
                  fatherName: request.baptismForm ? `${request.baptismForm.father_first_name} ${request.baptismForm.father_last_name}` : 'N/A',
                }
              };
            } 
            else if (formType === 'service' || request.serviceForm || request.service_form_id) {
              let serviceType = 'Church Service';
              if (serviceName === 'Funeral Mass') {
                serviceType = 'Funeral Mass';
              } else if (serviceName === 'House Blessing') {
                serviceType = 'House Blessing';
              } else if (serviceName === 'Marriage') {
                serviceType = 'Marriage';
              }
              
              const personName = request.serviceForm?.full_name || getUserFullName(request.user) || 'N/A';
              service = {
                id: request.request_id,
                type: serviceType,
                name: personName,
                date: formattedDate,
                time: request.preferred_time || 'TBA',
                status: request.status,
                displayStatus: getDisplayStatus(request.status),
                isCompleted: false,
                requestDetails: {
                  ...requestDetails,
                  serviceName: serviceName,
                }
              };
            } 
            else if (formType === 'certificate' || request.certificateForm || request.certificate_form_id) {
              const certType = request.certificateForm?.certificate_type === 'marriage' ? 'Marriage Certificate' : 'Baptismal Certificate';
              const certName = request.certificateForm?.full_name || getUserFullName(request.user) || 'N/A';
              service = {
                id: request.request_id,
                type: certType,
                name: certName,
                date: formattedDate,
                time: request.preferred_time || 'TBA',
                status: request.status,
                displayStatus: getDisplayStatus(request.status),
                isCompleted: false,
                requestDetails: {
                  ...requestDetails,
                  certificateType: request.certificateForm?.certificate_type || 'N/A',
                }
              };
            } else {
              if (serviceName) {
                const personName = getUserFullName(request.user) || 'N/A';
                service = {
                  id: request.request_id,
                  type: serviceName,
                  name: personName,
                  date: formattedDate,
                  time: request.preferred_time || 'TBA',
                  status: request.status,
                  displayStatus: getDisplayStatus(request.status),
                  isCompleted: false,
                  requestDetails: {
                    ...requestDetails,
                  }
                };
              }
            }
            
            if (service) {
              services.push(service);
            }
          }
        });
        
        const sortedServices = services.sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        setAllServices(sortedServices);
      } else {
        console.log('No data or unsuccessful response');
      }
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
          setAllServices(prevServices => prevServices.filter(s => s.id !== serviceId));
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
    setNotificationModal({
      isOpen: true,
      title: 'Coming Soon',
      message: 'Reschedule functionality is currently under development. Please check back later.',
      type: 'info'
    });
  };

  const handleChangePriest = () => {
    setNotificationModal({
      isOpen: true,
      title: 'Coming Soon',
      message: 'Change assigned priest functionality is currently under development. Please check back later.',
      type: 'info'
    });
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

  const getServiceIcon = (type: string) => {
    switch(type) {
      case "House Blessing": return "🏠";
      case "Funeral Mass": return "🕯️";
      case "Baptism": return "💧";
      case "Marriage": return "💒";
      case "Baptismal Certificate": 
      case "Marriage Certificate": return "📜";
      case "Church Service": return "⛪";
      default: return "📅";
    }
  };

  const getServiceColor = (type: string) => {
    switch(type) {
      case "Baptism": return "bg-blue-100 border-blue-400 text-blue-700";
      case "Funeral Mass": return "bg-purple-100 border-purple-400 text-purple-700";
      case "House Blessing": return "bg-green-100 border-green-400 text-green-700";
      case "Marriage": return "bg-pink-100 border-pink-400 text-pink-700";
      case "Baptismal Certificate": 
      case "Marriage Certificate": return "bg-amber-100 border-amber-400 text-amber-700";
      case "Church Service": return "bg-gray-100 border-gray-400 text-gray-700";
      default: return "bg-gray-100 border-gray-400 text-gray-700";
    }
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

  const renderStats = () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <StatCard 
        icon="📊" 
        label="Total Scheduled" 
        value={allServices.length}
        color="blue"
      />
      <StatCard 
        icon="🏷️" 
        label="Service Types" 
        value={new Set(allServices.map(s => s.type)).size}
        color="purple"
      />
      <StatCard 
        icon="📆" 
        label="Today" 
        value={getServicesForDate(new Date().toISOString().split('T')[0]).length}
        color="green"
      />
    </div>
  );

  const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: number; color: 'blue' | 'purple' | 'green' }) => {
    const colorClasses = {
      blue: 'text-blue-600',
      purple: 'text-purple-600',
      green: 'text-green-600'
    };
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium">{label}</p>
            <p className={`text-3xl font-bold ${colorClasses[color]} mt-1`}>{value}</p>
          </div>
          <span className="text-4xl opacity-80">{icon}</span>
        </div>
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

      cells.push(
        <div
          key={`day-${day}`}
          onClick={() => hasServices && handleDateClick(dateKey)}
          className={`
            h-28 border border-gray-100 p-1.5 transition-all duration-200
            ${hasServices 
              ? 'cursor-pointer hover:bg-blue-50 hover:shadow-inner hover:scale-[1.02] hover:z-10 relative' 
              : 'bg-gray-50/30 cursor-default opacity-60'}
            ${isTodayDate ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
            ${selectedDate === dateKey ? 'bg-blue-100 ring-2 ring-blue-400' : ''}
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
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500 text-white rounded-full shadow-sm">
                {servicesOnDay.length}
              </span>
            )}
          </div>
          
          {hasServices && (
            <div className="mt-1.5 space-y-0.5">
              {servicesOnDay.slice(0, 2).map((service, idx) => (
                <div 
                  key={idx}
                  className={`text-[10px] truncate px-1.5 py-0.5 rounded border-l-2 ${getServiceColor(service.type)}`}
                  title={service.name}
                >
                  <span className="mr-0.5">{getServiceIcon(service.type)}</span>
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
              {servicesOnDate.map((service) => (
                <div 
                  key={service.id} 
                  className="flex items-center justify-between p-4 rounded-xl transition-all duration-200 bg-blue-50/50 border border-blue-100 hover:shadow-md hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{getServiceIcon(service.type)}</span>
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
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                      Scheduled
                    </span>
                    <button
                      onClick={() => {
                        closeModal();
                        handleViewDetails(service);
                      }}
                      className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm hover:shadow"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
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
                    <span>{getServiceIcon(selectedService.type)}</span>
                    {selectedService.type}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                  <span className="inline-block mt-1 px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                    Scheduled
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
                <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span>📋</span> Complete Request Details
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
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span>⚡</span> Actions
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
                        <span>✅</span>
                        Mark as Completed
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleReschedule}
                    className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow"
                  >
                    <span>📅</span>
                    Reschedule
                  </button>

                  <button
                    onClick={handleChangePriest}
                    className="px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow"
                  >
                    <span>👨‍⚖️</span>
                    Change Priest
                  </button>
                </div>
              </div>
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
          <div className="text-4xl mb-3">⚠️</div>
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
              <h1 className="text-3xl font-bold text-gray-900">
                📅 Scheduled Services
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage all approved services. Click on a date to view details.
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