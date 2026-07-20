import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { manageRequestAPI, getUserFullName } from '../../../../library/manage-request';
import type { ManageRequest, RequestStatus, PaymentStatus } from '../../../../library/manage-request';
import { usersAPI } from '../../../../library/api';
import {
  notificationAPI,
  formatNotificationTime,
  type Notification,
} from '../../../../library/notification';
import {
  Calendar,
  Clock,
  User,
  RefreshCw,
  AlertCircle,
  LogOut,
  Bell,
  CheckCircle2,
  MapPin,
  Phone,
  Eye,
} from 'lucide-react';
import PriestNav from './PriestNav';

interface PriestSchedule {
  id: number;
  requestId: number;
  serviceType: string;
  formSummary: string;
  parishionerName: string;
  preferredDate: string;
  preferredTime: string;
  status: RequestStatus;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  serviceFee: number;
  address?: string;
  contactNumber?: string;
  email?: string;
}

type PriestStatus = 'available' | 'unavailable';

const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

const formatTime = (timeString: string): string => {
  if (!timeString) return 'TBA';
  const matches = timeString.match(/(\d{2}):(\d{2})/g);
  const pick = matches && matches.length > 0 ? matches[matches.length - 1] : null;
  const parts = (pick || timeString).match(/(\d{2}):(\d{2})/);
  if (!parts) return timeString;
  const hours = parseInt(parts[1], 10);
  const minutes = parseInt(parts[2], 10);
  if (isNaN(hours) || isNaN(minutes)) return timeString;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

const getStatusBadgeColor = (status: RequestStatus): string => {
  const colors: Record<RequestStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    done: 'bg-purple-100 text-purple-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const getPaymentBadge = (paymentStatus: PaymentStatus, requestStatus: RequestStatus) => {
  if (requestStatus === 'cancelled') {
    return { label: 'No payment due', className: 'bg-gray-100 text-gray-600' };
  }
  if (paymentStatus === 'paid') {
    return { label: 'Paid', className: 'bg-emerald-100 text-emerald-800' };
  }
  if (paymentStatus === 'partial') {
    return { label: 'Partial', className: 'bg-amber-100 text-amber-800' };
  }
  return { label: 'Unpaid', className: 'bg-orange-100 text-orange-800' };
};

const getServiceIcon = (serviceName: string): string => {
  const name = serviceName?.toLowerCase() || '';
  if (name.includes('baptism')) return '💧';
  if (name.includes('funeral')) return '✝️';
  if (name.includes('marriage')) return '💒';
  if (name.includes('house blessing') || name.includes('blessing')) return '🏠';
  if (name.includes('certificate')) return '📜';
  if (name.includes('special intention') || name.includes('intention')) return '🙏';
  return '⛪';
};

const mapRequestToSchedule = (req: ManageRequest): PriestSchedule => ({
  id: req.request_id,
  requestId: req.request_id,
  serviceType:
    req.service?.service_type ||
    (req.service as { service_name?: string } | undefined)?.service_name ||
    req.form_type_label ||
    'Church Service',
  formSummary: req.form_summary || 'No additional details',
  parishionerName: getUserFullName(req.user),
  preferredDate: req.preferred_date || '',
  preferredTime: req.preferred_time || '',
  status: req.status,
  paymentStatus: req.payment_status,
  amountPaid: Number(req.amount_paid || 0),
  serviceFee: Number(req.service?.fee || 0),
  address: req.user?.address || 'N/A',
  contactNumber: req.user?.contact_number || 'N/A',
  email: req.user?.email || 'N/A',
});

const PriestHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [schedules, setSchedules] = useState<PriestSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priestStatus, setPriestStatus] = useState<PriestStatus>(
    user?.is_available === false ? 'unavailable' : 'available'
  );
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [selectedSchedule, setSelectedSchedule] = useState<PriestSchedule | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const fetchAssignedRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Priest fetching assigned requests...');
      const response = await manageRequestAPI.getAssignedRequests({ per_page: 100 });

      if (response.data?.success && response.data?.data) {
        const payload = response.data.data as { data?: ManageRequest[] } | ManageRequest[];
        const requests = Array.isArray(payload) ? payload : payload.data || [];
        const mapped = requests.map(mapRequestToSchedule);
        console.log('Priest assigned requests loaded:', mapped.length);
        setSchedules(mapped);
      } else {
        setSchedules([]);
      }
    } catch (err) {
      console.error('Error fetching assigned requests:', err);
      setError('Failed to load your schedule. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifications(true);
      const [countRes, listRes] = await Promise.all([
        notificationAPI.getPriestUnreadCount(),
        notificationAPI.getPriestUnread(15),
      ]);

      if (countRes.data?.success) {
        setUnreadCount(countRes.data.data?.count || 0);
      }

      if (listRes.data?.success) {
        setNotifications(listRes.data.data?.notifications || []);
      }
    } catch (err) {
      console.error('Error fetching priest notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignedRequests();
    fetchNotifications();
  }, [fetchAssignedRequests, fetchNotifications]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', onClickOutside);
    }
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showNotifications]);

  const toggleStatus = async () => {
    const nextAvailable = priestStatus !== 'available';
    const previousStatus = priestStatus;
    setPriestStatus(nextAvailable ? 'available' : 'unavailable');
    setStatusUpdating(true);
    try {
      console.log('Updating priest availability:', nextAvailable);
      const response = await usersAPI.updateAvailability(nextAvailable);
      if (response.data?.success && response.data?.data) {
        updateUser(response.data.data);
      }
    } catch (err) {
      console.error('Error updating priest availability:', err);
      setPriestStatus(previousStatus);
      alert('Failed to update availability. Please try again.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Failed to logout. Please try again.');
    }
  };

  const handleMarkNotificationRead = async (notificationId: number) => {
    try {
      await notificationAPI.markPriestAsRead(notificationId);
      setNotifications((prev) => prev.filter((n) => n.notification_id !== notificationId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markPriestAllAsRead();
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const getFilteredSchedules = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return schedules.filter((schedule) => {
      const date = new Date(schedule.preferredDate);
      date.setHours(0, 0, 0, 0);

      if (filter === 'upcoming') {
        return date >= today && schedule.status !== 'cancelled' && schedule.status !== 'done';
      }
      if (filter === 'past') {
        return date < today || schedule.status === 'done' || schedule.status === 'cancelled';
      }
      return true;
    });
  };

  const filteredSchedules = getFilteredSchedules();
  const todaySchedules = schedules.filter((s) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(s.preferredDate);
    date.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime() && s.status !== 'cancelled' && s.status !== 'done';
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <LogOut className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Confirm Logout</h3>
            </div>
            <p className="text-gray-600 mb-6">Are you sure you want to logout from your account?</p>
            <div className="flex gap-3">
              <button
                onClick={handleLogout}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
              >
                Yes, Logout
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <span>⛪</span> Priest Dashboard
            </h1>
            <p className="text-gray-500 mt-1">Welcome back, {user?.full_name || 'Priest'}!</p>
            <p className="text-xs text-gray-400 mt-1">View-only schedule. Secretary manages request actions.</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => {
                  setShowNotifications((v) => !v);
                  if (!showNotifications) fetchNotifications();
                }}
                className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-800">Notifications</h4>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {loadingNotifications ? (
                      <p className="p-4 text-sm text-gray-500 text-center">Loading...</p>
                    ) : notifications.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500 text-center">No unread notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.notification_id}
                          onClick={() => handleMarkNotificationRead(n.notification_id)}
                          className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-blue-50 transition"
                        >
                          <p className="text-sm font-semibold text-gray-800">{n.title}</p>
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{n.message}</p>
                          <p className="text-[11px] text-gray-400 mt-1">{formatNotificationTime(n.created_at)}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-medium ${
                  priestStatus === 'available' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {priestStatus === 'available' ? 'Available' : 'Unavailable'}
              </span>
              <button
                onClick={toggleStatus}
                disabled={statusUpdating}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                  priestStatus === 'available' ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    priestStatus === 'available' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <button
              onClick={() => {
                fetchAssignedRequests();
                fetchNotifications();
              }}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <PriestNav />

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white mb-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-blue-100 text-sm">Today&apos;s Schedule</p>
              <p className="text-2xl font-bold mt-1">
                {todaySchedules.length} service{todaySchedules.length === 1 ? '' : 's'}
              </p>
              <p className="text-blue-100 text-sm mt-1">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              {todaySchedules.length === 0 && (
                <p className="text-blue-100 text-sm mt-2">No services scheduled for today</p>
              )}
            </div>
            <Calendar className="w-12 h-12 text-blue-200" />
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {(['upcoming', 'all', 'past'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                filter === key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {key === 'upcoming' ? 'Upcoming' : key === 'all' ? 'All' : 'Past'}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">
              {filter === 'upcoming' ? 'Upcoming Services' : filter === 'past' ? 'Past Services' : 'All Services'}
            </h2>
            <span className="text-sm text-gray-500">{filteredSchedules.length} services</span>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
              <p className="mt-4 text-gray-500">Loading your schedule...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-500">{error}</p>
              <button
                onClick={fetchAssignedRequests}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Try Again
              </button>
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <p>
                {filter === 'upcoming'
                  ? 'You have no upcoming services assigned.'
                  : 'No services in this list.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredSchedules.map((schedule) => {
                const payment = getPaymentBadge(schedule.paymentStatus, schedule.status);
                return (
                  <div key={schedule.id} className="px-5 py-4 hover:bg-gray-50 transition">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xl">{getServiceIcon(schedule.serviceType)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900">{schedule.serviceType}</span>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeColor(
                                schedule.status
                              )}`}
                            >
                              {schedule.status.toUpperCase()}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${payment.className}`}>
                              {payment.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3" />
                            {schedule.parishionerName}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{schedule.formSummary}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(schedule.preferredDate)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(schedule.preferredTime)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedSchedule(schedule);
                          setShowModal(true);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition self-start lg:self-center"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{schedules.length}</p>
            <p className="text-xs text-gray-500">Total Services</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {schedules.filter((s) => s.status === 'pending').length}
            </p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {schedules.filter((s) => s.status === 'approved').length}
            </p>
            <p className="text-xs text-gray-500">Approved</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {schedules.filter((s) => s.paymentStatus === 'paid').length}
            </p>
            <p className="text-xs text-gray-500">Paid</p>
          </div>
        </div>
      </div>

      {showModal && selectedSchedule && (
        <div className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-800">Service Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Service Type</p>
                <p className="font-medium text-gray-900 flex items-center gap-2">
                  <span>{getServiceIcon(selectedSchedule.serviceType)}</span>
                  {selectedSchedule.serviceType}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Summary</p>
                <p className="font-medium text-gray-900 whitespace-pre-wrap">{selectedSchedule.formSummary}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Parishioner</p>
                <p className="font-medium text-gray-900">{selectedSchedule.parishionerName}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Date & Time</p>
                <p className="font-medium text-gray-900">
                  {formatDate(selectedSchedule.preferredDate)} at{' '}
                  {formatTime(selectedSchedule.preferredTime)}
                </p>
              </div>

              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Contact Number</p>
                  <p className="font-medium text-gray-900">{selectedSchedule.contactNumber}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium text-gray-900">{selectedSchedule.address}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(
                    selectedSchedule.status
                  )}`}
                >
                  {selectedSchedule.status.toUpperCase()}
                </span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    getPaymentBadge(selectedSchedule.paymentStatus, selectedSchedule.status).className
                  }`}
                >
                  {getPaymentBadge(selectedSchedule.paymentStatus, selectedSchedule.status).label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
                <div>
                  <p className="text-xs text-gray-500">Service Fee</p>
                  <p className="font-semibold text-gray-800">
                    ₱{Number(selectedSchedule.serviceFee || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Amount Paid</p>
                  <p className="font-semibold text-emerald-700 flex items-center gap-1">
                    {selectedSchedule.paymentStatus === 'paid' && (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    ₱
                    {Number(
                      selectedSchedule.status === 'cancelled' ? 0 : selectedSchedule.amountPaid || 0
                    ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriestHomePage;
