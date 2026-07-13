import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { api, type Request } from '../../../../library/api';
import { useAuth } from '../../../../context/AuthContext';
import ParishionerHeader from '../../../../components/ParishionerHeader';
import ResponsiveContainer from '../../../../components/ResponsiveContainer';
import { useResponsive } from '../../../../hooks/useResponsive';

type StatusFilter = 'all' | 'approved' | 'done' | 'cancelled' | 'pending';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'done', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'pending', label: 'Pending' },
];

const getStatusConfig = (status: Request['status']) => {
  switch (status) {
    case 'approved':
      return { label: 'Approved', bg: 'bg-green-100', text: 'text-green-700', icon: 'check-circle' as const };
    case 'done':
      return { label: 'Completed', bg: 'bg-blue-100', text: 'text-blue-700', icon: 'check-double' as const };
    case 'cancelled':
      return { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-700', icon: 'times-circle' as const };
    case 'pending':
      return { label: 'Pending', bg: 'bg-yellow-100', text: 'text-yellow-700', icon: 'clock' as const };
    default:
      return { label: status, bg: 'bg-gray-100', text: 'text-gray-700', icon: 'file-alt' as const };
  }
};

const formatDateLong = (value?: string | null) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

const formatTime = (value?: string | null) => {
  if (!value) return 'TBA';
  const match = value.match(/(\d{2}):(\d{2})/);
  if (!match) return value;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

const formatPeso = (amount: number) => `₱${Number(amount || 0).toLocaleString()}`;

const getServiceFee = (request: Request) => Number(request.service?.fee || 0);

const getBalanceDue = (request: Request) => {
  if (typeof request.remaining_balance === 'number') {
    return Math.max(0, request.remaining_balance);
  }
  return Math.max(0, getServiceFee(request) - Number(request.amount_paid || 0));
};

const getServiceTitle = (request: Request) => {
  return (
    request.service?.service_name ||
    request.service?.service_type ||
    request.form_type_label ||
    request.form_type ||
    'Church Service'
  );
};

const getScheduledDate = (request: Request) =>
  request.formatted_preferred_date || formatDateLong(request.preferred_date);

const getScheduledTime = (request: Request) =>
  request.formatted_preferred_time || formatTime(request.preferred_time);

const wasRescheduled = (request: Request) =>
  Boolean(
    request.reschedule_reason ||
      request.rescheduled_by ||
      (request.reschedule_count && request.reschedule_count > 0)
  );

const getRescheduledByName = (request: Request) => {
  if (request.rescheduledBy?.full_name) return request.rescheduledBy.full_name;
  if (request.rescheduledBy?.first_name) {
    return `${request.rescheduledBy.first_name} ${request.rescheduledBy.last_name || ''}`.trim();
  }
  return 'Parish staff';
};

const getStatusScheduleText = (request: Request) => {
  if (request.status === 'approved' || request.status === 'done') {
    return `${getScheduledDate(request)} at ${getScheduledTime(request)}`;
  }
  if (request.status === 'pending') {
    return `Requested: ${getScheduledDate(request)} at ${getScheduledTime(request)}`;
  }
  if (request.status === 'cancelled') {
    return `Was scheduled: ${getScheduledDate(request)} at ${getScheduledTime(request)}`;
  }
  return null;
};

export default function MyRequestsScreen() {
  const { user } = useAuth();
  const { isCompact } = useResponsive();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!user) return;

    try {
      console.log('Fetching parishioner requests:', statusFilter);
      const response = await api.getUserRequests({
        per_page: 100,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });

      if (response.success && response.data?.data) {
        setRequests(response.data.data);
        console.log('Parishioner requests loaded:', response.data.data.length);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching parishioner requests:', error);
      setRequests([]);
    }
  }, [user, statusFilter]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchRequests();
      setLoading(false);
    };
    load();
  }, [fetchRequests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  const openDetails = (request: Request) => {
    console.log('Opening request details:', request.request_id);
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const closeDetails = () => {
    setShowDetailModal(false);
    setSelectedRequest(null);
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center" edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ParishionerHeader title="My Requests" subtitle="View your service request records" />

      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {STATUS_FILTERS.map((filter) => {
              const active = statusFilter === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  onPress={() => setStatusFilter(filter.key)}
                  className={`px-4 py-2 rounded-full border ${
                    active ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-600'}`}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-gray-500 mt-3">Loading your requests...</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        >
          <ResponsiveContainer className="pt-4">
            {requests.length === 0 ? (
              <View className="items-center justify-center py-16 px-6">
                <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
                  <FontAwesome5 name="clipboard-list" size={28} color="#9CA3AF" />
                </View>
                <Text className="text-lg font-bold text-gray-800 mb-2">No Requests Found</Text>
                <Text className="text-gray-500 text-center text-sm">
                  {statusFilter === 'all'
                    ? 'You have not submitted any service requests yet.'
                    : `No ${STATUS_FILTERS.find((f) => f.key === statusFilter)?.label.toLowerCase()} requests yet.`}
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {requests.map((request) => {
                  const statusConfig = getStatusConfig(request.status);
                  const scheduleText = getStatusScheduleText(request);
                  const rescheduled = wasRescheduled(request);

                  return (
                    <TouchableOpacity
                      key={request.request_id}
                      onPress={() => openDetails(request)}
                      activeOpacity={0.8}
                      className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                    >
                      <View className="flex-row items-start justify-between mb-3">
                        <View className="flex-1 pr-3">
                          <Text className="text-base font-bold text-gray-800">{getServiceTitle(request)}</Text>
                          <Text className="text-sm text-gray-500 mt-1" numberOfLines={2}>
                            {request.form_summary || 'Service request'}
                          </Text>
                        </View>
                        <View className="items-end gap-1">
                          <View className={`px-3 py-1 rounded-full ${statusConfig.bg}`}>
                            <Text className={`text-xs font-semibold ${statusConfig.text}`}>
                              {statusConfig.label}
                            </Text>
                          </View>
                          {rescheduled ? (
                            <View className="px-2 py-0.5 rounded-full bg-purple-100">
                              <Text className="text-[10px] font-semibold text-purple-700">Rescheduled</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      {scheduleText ? (
                        <View className="mb-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                          <Text className="text-xs font-semibold text-blue-800">
                            {request.status === 'approved'
                              ? 'Scheduled for'
                              : request.status === 'done'
                                ? 'Completed on'
                                : request.status === 'pending'
                                  ? 'Preferred schedule'
                                  : 'Schedule'}
                          </Text>
                          <Text className="text-sm text-blue-900 mt-0.5">{scheduleText}</Text>
                        </View>
                      ) : null}

                      <View className="flex-row flex-wrap gap-3">
                        {request.approved_at && request.status === 'approved' ? (
                          <View className="flex-row items-center">
                            <FontAwesome5 name="check-circle" size={12} color="#059669" />
                            <Text className="text-xs text-gray-600 ml-2">
                              Approved {formatDate(request.approved_at)}
                            </Text>
                          </View>
                        ) : null}
                        <View className="flex-row items-center">
                          <FontAwesome5 name="money-bill-wave" size={12} color="#6B7280" />
                          <Text className="text-xs text-gray-600 ml-2">
                            Fee: {formatPeso(getServiceFee(request))}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ResponsiveContainer>
        </ScrollView>
      )}

      <Modal visible={showDetailModal} transparent animationType="fade" onRequestClose={closeDetails}>
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className={`bg-white rounded-2xl w-full ${isCompact ? 'max-w-md' : 'max-w-lg'} max-h-[85%]`}>
            {selectedRequest ? (
              <>
                <View className="px-5 py-4 border-b border-gray-200 flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-gray-800">Request Details</Text>
                  <TouchableOpacity onPress={closeDetails} className="p-2">
                    <Ionicons name="close" size={22} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
                  <View className="mb-4">
                    <Text className="text-xs font-semibold text-gray-500 uppercase">Service</Text>
                    <Text className="text-base font-bold text-gray-800 mt-1">
                      {getServiceTitle(selectedRequest)}
                    </Text>
                  </View>

                  <View className="mb-4">
                    <Text className="text-xs font-semibold text-gray-500 uppercase">Status</Text>
                    <View className="mt-2 gap-2">
                      {(() => {
                        const statusConfig = getStatusConfig(selectedRequest.status);
                        const scheduleText = getStatusScheduleText(selectedRequest);
                        const rescheduled = wasRescheduled(selectedRequest);

                        return (
                          <>
                            <View className="flex-row flex-wrap items-center gap-2">
                              <View className={`px-3 py-1 rounded-full ${statusConfig.bg}`}>
                                <Text className={`text-sm font-semibold ${statusConfig.text}`}>
                                  {statusConfig.label}
                                </Text>
                              </View>
                              {rescheduled ? (
                                <View className="px-3 py-1 rounded-full bg-purple-100">
                                  <Text className="text-sm font-semibold text-purple-700">Rescheduled</Text>
                                </View>
                              ) : null}
                            </View>

                            {scheduleText ? (
                              <View className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                <Text className="text-xs font-semibold text-blue-800 uppercase">
                                  {selectedRequest.status === 'approved'
                                    ? 'Scheduled Date & Time'
                                    : selectedRequest.status === 'done'
                                      ? 'Service Date & Time'
                                      : 'Preferred Date & Time'}
                                </Text>
                                <Text className="text-sm font-bold text-blue-900 mt-1">{scheduleText}</Text>
                              </View>
                            ) : null}

                            {selectedRequest.approved_at && selectedRequest.status === 'approved' ? (
                              <Text className="text-sm text-gray-600">
                                Approved on {formatDateLong(selectedRequest.approved_at)}
                              </Text>
                            ) : null}

                            {selectedRequest.completed_at && selectedRequest.status === 'done' ? (
                              <Text className="text-sm text-gray-600">
                                Completed on {formatDateLong(selectedRequest.completed_at)}
                              </Text>
                            ) : null}
                          </>
                        );
                      })()}
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="text-xs font-semibold text-gray-500 uppercase">Summary</Text>
                    <Text className="text-sm text-gray-700 mt-1">
                      {selectedRequest.form_summary || 'N/A'}
                    </Text>
                  </View>

                  <View className="flex-row gap-4 mb-4">
                    <View className="flex-1">
                      <Text className="text-xs font-semibold text-gray-500 uppercase">Date</Text>
                      <Text className="text-sm text-gray-800 mt-1">{getScheduledDate(selectedRequest)}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-semibold text-gray-500 uppercase">Time</Text>
                      <Text className="text-sm text-gray-800 mt-1">{getScheduledTime(selectedRequest)}</Text>
                    </View>
                  </View>

                  <View className="mb-4 bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <Text className="text-xs font-semibold text-gray-500 uppercase mb-3">Payment Details</Text>

                    <View className="flex-row gap-4 mb-3">
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-gray-500 uppercase">Service Fee</Text>
                        <Text className="text-sm font-bold text-gray-800 mt-1">
                          {formatPeso(getServiceFee(selectedRequest))}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-gray-500 uppercase">Payment Status</Text>
                        <Text className="text-sm text-gray-800 mt-1 capitalize">
                          {selectedRequest.payment_status}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row gap-4">
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-gray-500 uppercase">Amount Paid</Text>
                        <Text className="text-sm text-gray-800 mt-1">
                          {formatPeso(selectedRequest.amount_paid)}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-gray-500 uppercase">Balance to Pay</Text>
                        <Text
                          className={`text-sm font-bold mt-1 ${
                            getBalanceDue(selectedRequest) > 0 ? 'text-amber-700' : 'text-green-700'
                          }`}
                        >
                          {formatPeso(getBalanceDue(selectedRequest))}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {selectedRequest.assignedPriest?.full_name ? (
                    <View className="mb-4">
                      <Text className="text-xs font-semibold text-gray-500 uppercase">Assigned Priest</Text>
                      <Text className="text-sm text-gray-800 mt-1">
                        {selectedRequest.assignedPriest.full_name}
                      </Text>
                    </View>
                  ) : null}

                  {wasRescheduled(selectedRequest) ? (
                    <View className="mb-4 bg-purple-50 border border-purple-100 rounded-xl p-3">
                      <Text className="text-xs font-semibold text-purple-700 uppercase">Reschedule Information</Text>
                      <Text className="text-sm text-purple-900 mt-2 font-medium">
                        This request was rescheduled to {getScheduledDate(selectedRequest)} at{' '}
                        {getScheduledTime(selectedRequest)}.
                      </Text>
                      <Text className="text-sm text-purple-800 mt-2">
                        Rescheduled by: {getRescheduledByName(selectedRequest)}
                      </Text>
                      {selectedRequest.reschedule_reason ? (
                        <Text className="text-sm text-purple-800 mt-2">
                          Reason: {selectedRequest.reschedule_reason}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {selectedRequest.cancelled_reason ? (
                    <View className="mb-4 bg-red-50 border border-red-100 rounded-xl p-3">
                      <Text className="text-xs font-semibold text-red-700 uppercase">Cancellation Reason</Text>
                      <Text className="text-sm text-red-800 mt-1">{selectedRequest.cancelled_reason}</Text>
                    </View>
                  ) : null}

                  <View className="mb-2">
                    <Text className="text-xs font-semibold text-gray-500 uppercase">Submitted</Text>
                    <Text className="text-sm text-gray-800 mt-1">
                      {formatDate(selectedRequest.created_at)}
                    </Text>
                  </View>
                </ScrollView>

                <View className="px-5 py-4 border-t border-gray-200">
                  <TouchableOpacity
                    onPress={closeDetails}
                    className="bg-blue-600 rounded-xl py-3 items-center"
                  >
                    <Text className="text-white font-semibold">Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
