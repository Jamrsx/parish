import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { manageRequestAPI } from '../../../../library/manage-request';
import { usersAPI } from '../../../../library/api';
import { getUserFullName } from '../../../../library/manage-request';
import type { ManageRequest, RequestStatus } from '../../../../library/manage-request';
import { Calendar, Clock, User, RefreshCw, AlertCircle, LogOut } from 'lucide-react';

// ============ TYPE DEFINITIONS ============
interface PriestSchedule {
  id: number;
  serviceType: string;
  parishionerName: string;
  preferredDate: string;
  preferredTime: string;
  status: RequestStatus;
  address?: string;
  contactNumber?: string;
  requestId: number;
}

type PriestStatus = 'available' | 'unavailable';

// ============ HELPER FUNCTIONS ============
const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
};

const formatTime = (timeString: string): string => {
  if (!timeString) return 'TBA';
  const timeMatch = timeString.match(/(\d{2}):(\d{2})/);
  if (!timeMatch) return timeString;
  const hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
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

const getServiceIcon = (serviceName: string): string => {
  const name = serviceName?.toLowerCase() || '';
  if (name.includes('baptism')) return '💧';
  if (name.includes('funeral')) return '🕯️';
  if (name.includes('marriage')) return '💒';
  if (name.includes('house blessing') || name.includes('blessing')) return '🏠';
  if (name.includes('certificate')) return '📜';
  return '⛪';
};

// ============ MAIN COMPONENT ============
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
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Fetch assigned requests
  const fetchAssignedRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await manageRequestAPI.getAssignedRequests();
      
      if (response.data?.success && response.data?.data) {
        const requests = response.data.data.data || response.data.data || [];
        const mappedSchedules: PriestSchedule[] = requests.map((req: ManageRequest) => ({
          id: req.request_id,
          requestId: req.request_id,
          serviceType: req.service?.service_name || 'Unknown Service',
          parishionerName: getUserFullName(req.user),
          preferredDate: req.preferred_date || '',
          preferredTime: req.preferred_time || '',
          status: req.status,
          address: req.user?.address || 'N/A',
          contactNumber: req.user?.contact_number || 'N/A',
        }));
        setSchedules(mappedSchedules);
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

  // Initial fetch
  useEffect(() => {
    fetchAssignedRequests();
  }, [fetchAssignedRequests]);

  useEffect(() => {
    if (user?.is_available !== undefined) {
      setPriestStatus(user.is_available === false ? 'unavailable' : 'available');
    }
  }, [user?.is_available]);

  // Toggle priest availability
  const toggleStatus = async () => {
    const nextAvailable = priestStatus !== 'available';
    const previousStatus = priestStatus;

    setPriestStatus(nextAvailable ? 'available' : 'unavailable');
    setStatusUpdating(true);

    try {
      console.log('Updating priest availability:', nextAvailable);
      const response = await usersAPI.updateAvailability(nextAvailable);

      if (response.data?.success && response.data.data) {
        updateUser({ is_available: response.data.data.is_available });
        console.log('Priest availability updated:', response.data.data.is_available);
      } else {
        throw new Error(response.data?.message || 'Failed to update availability');
      }
    } catch (err) {
      console.error('Error updating priest availability:', err);
      setPriestStatus(previousStatus);
      alert('Failed to update availability. Please try again.');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Failed to logout. Please try again.');
    }
  };

  // Handle status update
  const handleUpdateRequestStatus = async (requestId: number, newStatus: RequestStatus) => {
    const confirmMessages: Record<RequestStatus, string> = {
      pending: 'Set this request to Pending?',
      approved: 'Approve this request?',
      done: 'Mark this request as Done?',
      cancelled: 'Cancel this request?',
    };

    if (!confirm(confirmMessages[newStatus])) {
      return;
    }

    setUpdatingStatus(requestId);
    try {
      const response = await manageRequestAPI.updateRequestStatus(requestId, { status: newStatus });
      if (response.data?.success) {
        setSchedules(prev =>
          prev.map(s =>
            s.id === requestId ? { ...s, status: newStatus } : s
          )
        );
        alert(`Request ${newStatus} successfully!`);
        fetchAssignedRequests();
      } else {
        alert(response.data?.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update request status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Filter schedules
  const getFilteredSchedules = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return schedules.filter(schedule => {
      if (filter === 'upcoming') {
        const date = new Date(schedule.preferredDate);
        date.setHours(0, 0, 0, 0);
        return date >= today && schedule.status !== 'cancelled' && schedule.status !== 'done';
      }
      if (filter === 'past') {
        const date = new Date(schedule.preferredDate);
        date.setHours(0, 0, 0, 0);
        return date < today || schedule.status === 'done' || schedule.status === 'cancelled';
      }
      return true;
    });
  };

  const filteredSchedules = getFilteredSchedules();
  const todaySchedules = schedules.filter(s => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(s.preferredDate);
    date.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime() && s.status !== 'cancelled' && s.status !== 'done';
  });

  // Handle view details
  const handleViewDetails = (schedule: PriestSchedule) => {
    setSelectedSchedule(schedule);
    setShowModal(true);
  };

  // Loading State
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading your schedule...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-500">{error}</p>
          <button
            onClick={fetchAssignedRequests}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <span>⛪</span> Priest Dashboard
            </h1>
            <p className="text-gray-500 mt-1">
              Welcome back, {user?.full_name || 'Priest'}!
            </p>
          </div>
          <div className="flex items-center gap-4 mt-3 sm:mt-0">
            {/* Status Toggle */}
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${priestStatus === 'available' ? 'text-green-600' : 'text-red-600'}`}>
                {priestStatus === 'available' ? 'Available' : 'Unavailable'}
              </span>
              <button
                onClick={toggleStatus}
                disabled={statusUpdating}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
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
              onClick={fetchAssignedRequests}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            {/* Logout Button */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Today's Schedule Card */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold opacity-90">Today's Schedule</h2>
              <p className="text-3xl font-bold">{todaySchedules.length} service{todaySchedules.length !== 1 ? 's' : ''}</p>
              <p className="text-sm opacity-80 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="text-5xl opacity-80">📅</div>
          </div>
          {todaySchedules.length > 0 && (
            <div className="mt-4 border-t border-blue-400/30 pt-4 space-y-2">
              {todaySchedules.slice(0, 3).map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>{getServiceIcon(schedule.serviceType)}</span>
                    <span>{schedule.serviceType}</span>
                    <span className="text-blue-200">•</span>
                    <span className="text-blue-200">{schedule.parishionerName}</span>
                  </div>
                  <span className="text-blue-200">{formatTime(schedule.preferredTime)}</span>
                </div>
              ))}
              {todaySchedules.length > 3 && (
                <p className="text-sm text-blue-200 text-center">+{todaySchedules.length - 3} more today</p>
              )}
            </div>
          )}
          {todaySchedules.length === 0 && (
            <p className="mt-2 text-blue-200">No services scheduled for today</p>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'upcoming'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            📅 Upcoming
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            📋 All
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'past'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            📆 Past
          </button>
        </div>

        {/* Schedule List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-800">
                {filter === 'upcoming' ? 'Upcoming Services' : filter === 'past' ? 'Past Services' : 'All Services'}
              </h2>
              <span className="ml-auto text-sm text-gray-500">{filteredSchedules.length} services</span>
            </div>
          </div>

          {filteredSchedules.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500 font-medium">No services found</p>
              <p className="text-sm text-gray-400 mt-1">
                {filter === 'upcoming' ? 'You have no upcoming services assigned.' : 'No services in this list.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                    schedule.status === 'cancelled' ? 'opacity-50 bg-red-50/30' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">{getServiceIcon(schedule.serviceType)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{schedule.serviceType}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeColor(schedule.status)}`}>
                            {schedule.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" />
                          {schedule.parishionerName}
                        </p>
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

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status Actions - Only for active requests */}
                      {schedule.status !== 'done' && schedule.status !== 'cancelled' && (
                        <>
                          {schedule.status === 'approved' && (
                            <button
                              onClick={() => handleUpdateRequestStatus(schedule.requestId, 'done')}
                              disabled={updatingStatus === schedule.id}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                            >
                              ✓ Complete
                            </button>
                          )}
                          {schedule.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateRequestStatus(schedule.requestId, 'approved')}
                              disabled={updatingStatus === schedule.id}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                            >
                              ✓ Approve
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateRequestStatus(schedule.requestId, 'cancelled')}
                            disabled={updatingStatus === schedule.id}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                          >
                            ✕ Cancel
                          </button>
                        </>
                      )}
                      {schedule.status === 'done' && (
                        <span className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 rounded-lg">
                          ✓ Completed
                        </span>
                      )}
                      {schedule.status === 'cancelled' && (
                        <span className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg">
                          ✕ Cancelled
                        </span>
                      )}
                      <button
                        onClick={() => handleViewDetails(schedule)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{schedules.length}</p>
            <p className="text-xs text-gray-500">Total Services</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {schedules.filter(s => s.status === 'pending').length}
            </p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {schedules.filter(s => s.status === 'approved').length}
            </p>
            <p className="text-xs text-gray-500">Approved</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">
              {schedules.filter(s => s.status === 'done').length}
            </p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
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
                <p className="text-sm text-gray-500">Parishioner</p>
                <p className="font-medium text-gray-900">{selectedSchedule.parishionerName}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Date & Time</p>
                <p className="font-medium text-gray-900">
                  {formatDate(selectedSchedule.preferredDate)} at {formatTime(selectedSchedule.preferredTime)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Contact Number</p>
                <p className="font-medium text-gray-900">{selectedSchedule.contactNumber}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium text-gray-900">{selectedSchedule.address}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(selectedSchedule.status)}`}>
                  {selectedSchedule.status.toUpperCase()}
                </span>
              </div>

              {/* Status Update Buttons in Modal */}
              {selectedSchedule.status !== 'done' && selectedSchedule.status !== 'cancelled' && (
                <div className="border-t border-gray-200 pt-4 flex flex-wrap gap-2">
                  {selectedSchedule.status === 'approved' && (
                    <button
                      onClick={() => {
                        handleUpdateRequestStatus(selectedSchedule.requestId, 'done');
                        setShowModal(false);
                      }}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition"
                    >
                      ✓ Mark as Done
                    </button>
                  )}
                  {selectedSchedule.status === 'pending' && (
                    <button
                      onClick={() => {
                        handleUpdateRequestStatus(selectedSchedule.requestId, 'approved');
                        setShowModal(false);
                      }}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition"
                    >
                      ✓ Approve
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleUpdateRequestStatus(selectedSchedule.requestId, 'cancelled');
                      setShowModal(false);
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
                  >
                    ✕ Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
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