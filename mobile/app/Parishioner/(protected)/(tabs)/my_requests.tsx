import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
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

/** Fallback only if API has not returned REQUEST_EXPIRY_MINUTES yet. */
const DEFAULT_EXPIRY_MINUTES = 60;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'done', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'pending', label: 'Pending' },
];

const isSpecialIntentionRequest = (request: Request) =>
  request.service?.service_type === 'Special Intention' ||
  request.service?.form_handler === 'special_intention' ||
  (request.service?.service_name || '').toLowerCase().includes('special intention') ||
  (request.form_type || '').toLowerCase().includes('special_intention');

/** Pending requests that auto-cancel after the expiry window (excludes Special Intention). */
const canRequestExpire = (request: Request) =>
  request.status === 'pending' && !isSpecialIntentionRequest(request);

const getExpiryRemainingMs = (
  request: Request,
  currentTime: number,
  expiryMinutes: number
): number | null => {
  if (!canRequestExpire(request) || !request.created_at) return null;
  const expiryMs = Math.max(1, expiryMinutes) * 60 * 1000;
  const expiresAt = new Date(request.created_at).getTime() + expiryMs;
  const remaining = expiresAt - currentTime;
  return remaining > 0 ? remaining : 0;
};

const formatExpiryCountdown = (remainingMs: number): string => {
  if (remainingMs <= 0) return 'Expiring now...';
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `Expires in ${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `Expires in ${seconds}s`;
};

const getStatusConfig = (status: Request['status'], request?: Request) => {
  if (request && isSpecialIntentionRequest(request) && status === 'pending') {
    return {
      label: 'Awaiting secretary',
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      icon: 'clock' as const,
    };
  }
  if (request && isSpecialIntentionRequest(request) && status === 'approved') {
    return {
      label: 'Pay at cashier',
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: 'check-circle' as const,
    };
  }

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

/** Clear pay / no-pay label for list cards and details */
const getPaymentConfig = (request: Request) => {
  if (request.status === 'cancelled') {
    return {
      label: 'No payment due',
      bg: 'bg-gray-100',
      text: 'text-gray-600',
      hint: 'This request was cancelled. No payment is required.',
      needsAttention: false,
    };
  }

  const fee = Number(request.service?.fee || 0);
  const status = (request.payment_status || 'unpaid').toLowerCase();

  if (fee <= 0) {
    // Special Intention with ₱0 = any amount; still visit cashier until marked paid.
    if (isSpecialIntentionRequest(request) && status !== 'paid') {
      return {
        label: request.status === 'pending' ? 'Awaiting secretary' : 'Any amount',
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        hint:
          request.status === 'pending'
            ? 'Await secretary approval, then visit the parish cashier. Any offering amount is accepted, including none.'
            : 'Visit the parish cashier. Any offering amount is accepted, including none.',
        needsAttention: true,
      };
    }
    return {
      label: 'No fee',
      bg: 'bg-gray-100',
      text: 'text-gray-600',
      hint: 'This service has no payment required.',
      needsAttention: false,
    };
  }
  if (status === 'paid') {
    return {
      label: 'Paid',
      bg: 'bg-green-100',
      text: 'text-green-700',
      hint: 'Payment received.',
      needsAttention: false,
    };
  }
  if (status === 'partial') {
    return {
      label: 'Partial',
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      hint: 'Partial payment recorded. Balance still due.',
      needsAttention: true,
    };
  }
  if (request.status === 'pending') {
    return {
      label: 'Needs payment',
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      hint: isSpecialIntentionRequest(request)
        ? 'Await secretary approval first, then pay at the parish cashier.'
        : 'Pay at the parish cashier after your request is approved.',
      needsAttention: true,
    };
  }
  return {
    label: 'Needs payment',
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    hint: 'Pay at the parish cashier to complete this request.',
    needsAttention: true,
  };
};

const countUnpaidRequests = (list: Request[]) =>
  list.filter((request) => getPaymentConfig(request).needsAttention).length;

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

/** Human-readable request reference shown to parishioners and cashiers (e.g. REQ-000042). */
const formatRequestId = (requestId: number) => `REQ-${String(requestId).padStart(6, '0')}`;

const getServiceFee = (request: Request) => Number(request.service?.fee || 0);

const getBalanceDue = (request: Request) => {
  if (request.status === 'cancelled') return 0;
  if (typeof request.remaining_balance === 'number') {
    return Math.max(0, request.remaining_balance);
  }
  return Math.max(0, getServiceFee(request) - Number(request.amount_paid || 0));
};

const getAmountPaidDisplay = (request: Request) => {
  if (request.status === 'cancelled') return 0;
  return Number(request.amount_paid || 0);
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
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [expiryMinutes, setExpiryMinutes] = useState(DEFAULT_EXPIRY_MINUTES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [unpaidFocusActive, setUnpaidFocusActive] = useState(false);
  const expireRefreshInFlight = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const cardRefs = useRef<Record<number, View | null>>({});
  const pendingScrollToUnpaid = useRef(false);

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
        if (typeof response.expiry_minutes === 'number' && response.expiry_minutes > 0) {
          setExpiryMinutes(response.expiry_minutes);
          console.log('Request expiry minutes from .env:', response.expiry_minutes);
        }
        console.log('Parishioner requests loaded:', response.data.data.length);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching parishioner requests:', error);
      setRequests([]);
    }
  }, [user, statusFilter]);

  const fetchUnpaidCount = useCallback(async () => {
    if (!user) return;

    try {
      console.log('Fetching unpaid request count');
      const response = await api.getUserRequests({ per_page: 100 });

      if (response.success && response.data?.data) {
        const count = countUnpaidRequests(response.data.data);
        setUnpaidCount(count);
        console.log('Unpaid requests count:', count);
      } else {
        setUnpaidCount(0);
      }
    } catch (error) {
      console.error('Error fetching unpaid count:', error);
    }
  }, [user]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchRequests(), fetchUnpaidCount()]);
      setLoading(false);
    };
    load();
  }, [fetchRequests, fetchUnpaidCount]);

  const hasExpiringPending = requests.some((request) => canRequestExpire(request));

  useEffect(() => {
    if (!hasExpiringPending) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [hasExpiringPending]);

  useEffect(() => {
    if (!hasExpiringPending || expireRefreshInFlight.current) return;

    const anyExpired = requests.some((request) => {
      const remaining = getExpiryRemainingMs(request, now, expiryMinutes);
      return remaining === 0;
    });

    if (!anyExpired) return;

    expireRefreshInFlight.current = true;
    (async () => {
      try {
        console.log('Pending request expiry reached — syncing with server');
        const expireRes = await api.expirePendingRequests();
        if (typeof expireRes.data?.expiry_minutes === 'number' && expireRes.data.expiry_minutes > 0) {
          setExpiryMinutes(expireRes.data.expiry_minutes);
          console.log('Request expiry minutes from expire API:', expireRes.data.expiry_minutes);
        }
        await Promise.all([fetchRequests(), fetchUnpaidCount()]);
      } catch (error) {
        console.error('Failed to sync expired requests:', error);
      } finally {
        expireRefreshInFlight.current = false;
      }
    })();
  }, [now, requests, hasExpiringPending, fetchRequests, fetchUnpaidCount, expiryMinutes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchRequests(), fetchUnpaidCount()]);
    setRefreshing(false);
  };

  const scrollToFirstUnpaid = useCallback(() => {
    const firstUnpaid = requests.find((request) => getPaymentConfig(request).needsAttention);
    if (!firstUnpaid) {
      console.log('No unpaid requests in current list to scroll to');
      return;
    }

    const card = cardRefs.current[firstUnpaid.request_id];
    const content = scrollContentRef.current;
    const scroll = scrollViewRef.current;
    if (!card || !content || !scroll) {
      console.log('Scroll refs not ready for unpaid request:', firstUnpaid.request_id);
      return;
    }

    card.measureLayout(
      content,
      (_x, y) => {
        console.log('Scrolling to unpaid request:', firstUnpaid.request_id, y);
        scroll.scrollTo({ y: Math.max(0, y - 16), animated: true });
        setUnpaidFocusActive(true);
        setTimeout(() => setUnpaidFocusActive(false), 2500);
      },
      () => console.error('Failed to measure unpaid card position')
    );
  }, [requests]);

  const handleUnpaidBannerPress = () => {
    console.log('Unpaid banner pressed');
    const hasUnpaidInList = requests.some((request) => getPaymentConfig(request).needsAttention);

    if (!hasUnpaidInList && statusFilter !== 'all') {
      pendingScrollToUnpaid.current = true;
      setStatusFilter('all');
      return;
    }

    scrollToFirstUnpaid();
  };

  useEffect(() => {
    if (!pendingScrollToUnpaid.current || loading) return;

    const hasUnpaidInList = requests.some((request) => getPaymentConfig(request).needsAttention);
    if (!hasUnpaidInList) {
      pendingScrollToUnpaid.current = false;
      return;
    }

    pendingScrollToUnpaid.current = false;
    const timer = setTimeout(() => scrollToFirstUnpaid(), 150);
    return () => clearTimeout(timer);
  }, [requests, loading, statusFilter, scrollToFirstUnpaid]);

  const openDetails = (request: Request) => {
    console.log('Opening request details:', request.request_id);
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const closeDetails = () => {
    setShowDetailModal(false);
    setSelectedRequest(null);
    setShowCancelModal(false);
    setCancelReason('');
    setCancelError('');
  };

  const openCancelModal = () => {
    setCancelReason('');
    setCancelError('');
    setShowCancelModal(true);
  };

  const handleCancelRequest = async () => {
    if (!selectedRequest) return;
    const reason = cancelReason.trim();
    if (reason.length < 5) {
      setCancelError('Please enter a reason (at least 5 characters).');
      return;
    }

    setCancelling(true);
    setCancelError('');
    try {
      console.log('Parishioner cancelling request:', selectedRequest.request_id);
      const res = await api.cancelOwnRequest(selectedRequest.request_id, reason);
      if (!res.success) {
        throw new Error(res.message || 'Failed to cancel request');
      }
      console.log('Request cancelled successfully:', selectedRequest.request_id);
      setShowCancelModal(false);
      setCancelReason('');
      closeDetails();
      await Promise.all([fetchRequests(), fetchUnpaidCount()]);
    } catch (error: any) {
      console.error('Cancel request failed:', error);
      setCancelError(error?.data?.message || error?.message || 'Unable to cancel. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    if (!selectedRequest) return;
    const fresh = requests.find((r) => r.request_id === selectedRequest.request_id);
    if (fresh && fresh !== selectedRequest) {
      setSelectedRequest(fresh);
    }
  }, [requests, selectedRequest]);

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

      {!loading && unpaidCount > 0 ? (
        <TouchableOpacity
          onPress={handleUnpaidBannerPress}
          activeOpacity={0.85}
          className="mx-4 mt-3 mb-1 rounded-2xl border border-orange-300 bg-orange-50 px-4 py-3 flex-row items-center gap-3"
        >
          <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center">
            <Ionicons name="wallet-outline" size={20} color="#C2410C" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-orange-900">
              {unpaidCount} request{unpaidCount !== 1 ? 's' : ''} need payment
            </Text>
            <Text className="text-xs text-orange-700 mt-0.5">
              Tap to view unpaid requests · Pay at the parish cashier
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="min-w-[28px] h-7 px-2 rounded-full bg-orange-500 items-center justify-center">
              <Text className="text-xs font-bold text-white">{unpaidCount}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#C2410C" />
          </View>
        </TouchableOpacity>
      ) : null}

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
          ref={scrollViewRef}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        >
          <ResponsiveContainer className="pt-4">
            <View ref={scrollContentRef} collapsable={false} className="w-full">
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
                  const statusConfig = getStatusConfig(request.status, request);
                  const paymentConfig = getPaymentConfig(request);
                  const scheduleText = getStatusScheduleText(request);
                  const rescheduled = wasRescheduled(request);
                  const expiryRemainingMs = getExpiryRemainingMs(request, now, expiryMinutes);
                  const unpaidNotice = paymentConfig.needsAttention;

                  return (
                    <View
                      key={request.request_id}
                      ref={(node) => {
                        cardRefs.current[request.request_id] = node;
                      }}
                      collapsable={false}
                    >
                    <TouchableOpacity
                      onPress={() => openDetails(request)}
                      activeOpacity={0.8}
                      className={`bg-white rounded-2xl border p-4 shadow-sm ${
                        unpaidNotice
                          ? `border-orange-300 border-l-4 border-l-orange-500 ${
                              unpaidFocusActive ? 'bg-orange-50/80' : ''
                            }`
                          : 'border-gray-100'
                      }`}
                    >
                      <View className="flex-row items-start justify-between mb-3">
                        <View className="flex-1 pr-3">
                          <View className="flex-row items-center gap-2 flex-wrap">
                            <Text className="text-base font-bold text-gray-800">{getServiceTitle(request)}</Text>
                            <View className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                              <Text className="text-[10px] font-bold text-slate-600 tracking-wide">
                                {formatRequestId(request.request_id)}
                              </Text>
                            </View>
                          </View>
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
                          <View
                            className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full ${paymentConfig.bg} ${
                              unpaidNotice ? 'border border-orange-400' : ''
                            }`}
                          >
                            {unpaidNotice ? (
                              <Ionicons name="alert-circle" size={12} color="#C2410C" />
                            ) : paymentConfig.label === 'Paid' ? (
                              <Ionicons name="checkmark-circle" size={12} color="#15803D" />
                            ) : null}
                            <Text className={`text-[10px] font-semibold ${paymentConfig.text}`}>
                              {paymentConfig.label}
                            </Text>
                          </View>
                          {expiryRemainingMs !== null ? (
                            <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                              <Ionicons name="timer-outline" size={11} color="#D97706" />
                              <Text className="text-[10px] font-semibold text-amber-700">
                                {formatExpiryCountdown(expiryRemainingMs)}
                              </Text>
                            </View>
                          ) : null}
                          {rescheduled ? (
                            <View className="px-2 py-0.5 rounded-full bg-purple-100">
                              <Text className="text-[10px] font-semibold text-purple-700">Rescheduled</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      {unpaidNotice ? (
                        <View className="mb-3 flex-row items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                          <Ionicons name="warning" size={16} color="#C2410C" />
                          <Text className="flex-1 text-xs font-semibold text-orange-800">
                            Payment needed — pay at the parish cashier
                            {getBalanceDue(request) > 0
                              ? ` (Balance: ${formatPeso(getBalanceDue(request))})`
                              : ''}
                          </Text>
                        </View>
                      ) : null}

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

                      <View className="flex-row flex-wrap items-center gap-3">
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
                        {getBalanceDue(request) > 0 ? (
                          <Text className="text-xs font-semibold text-amber-700">
                            Balance: {formatPeso(getBalanceDue(request))}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
            </View>
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
                  <View className="mb-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <Text className="text-xs font-semibold text-gray-500 uppercase">Request ID</Text>
                    <Text className="text-lg font-bold text-slate-800 mt-1 tracking-wide">
                      {formatRequestId(selectedRequest.request_id)}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1">
                      Show this ID at the parish cashier when paying.
                    </Text>
                  </View>

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
                        const statusConfig = getStatusConfig(selectedRequest.status, selectedRequest);
                        const scheduleText = getStatusScheduleText(selectedRequest);
                        const rescheduled = wasRescheduled(selectedRequest);
                        const expiryRemainingMs = getExpiryRemainingMs(selectedRequest, now, expiryMinutes);

                        return (
                          <>
                            <View className="flex-row flex-wrap items-center gap-2">
                              <View className={`px-3 py-1 rounded-full ${statusConfig.bg}`}>
                                <Text className={`text-sm font-semibold ${statusConfig.text}`}>
                                  {statusConfig.label}
                                </Text>
                              </View>
                              {expiryRemainingMs !== null ? (
                                <View className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-amber-50 border border-amber-200">
                                  <Ionicons name="timer-outline" size={14} color="#D97706" />
                                  <Text className="text-xs font-semibold text-amber-700">
                                    {formatExpiryCountdown(expiryRemainingMs)}
                                  </Text>
                                </View>
                              ) : null}
                              {rescheduled ? (
                                <View className="px-3 py-1 rounded-full bg-purple-100">
                                  <Text className="text-sm font-semibold text-purple-700">Rescheduled</Text>
                                </View>
                              ) : null}
                            </View>

                            {expiryRemainingMs !== null ? (
                              <Text className="text-xs text-amber-700">
                                This request will be cancelled automatically if not approved within{' '}
                                {expiryMinutes} minutes of submission.
                              </Text>
                            ) : null}

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

                  <View
                    className={`mb-4 rounded-xl p-4 border ${
                      getPaymentConfig(selectedRequest).needsAttention
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-xs font-semibold text-gray-500 uppercase">Payment Details</Text>
                      {(() => {
                        const paymentConfig = getPaymentConfig(selectedRequest);
                        return (
                          <View
                            className={`flex-row items-center gap-1 px-3 py-1 rounded-full ${paymentConfig.bg} ${
                              paymentConfig.needsAttention ? 'border border-orange-400' : ''
                            }`}
                          >
                            {paymentConfig.needsAttention ? (
                              <Ionicons name="alert-circle" size={14} color="#C2410C" />
                            ) : paymentConfig.label === 'Paid' ? (
                              <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                            ) : null}
                            <Text className={`text-xs font-semibold ${paymentConfig.text}`}>
                              {paymentConfig.label}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>

                    {getPaymentConfig(selectedRequest).needsAttention ? (
                      <View className="flex-row items-center gap-2 mb-3">
                        <Ionicons name="warning" size={16} color="#C2410C" />
                        <Text className="flex-1 text-sm font-semibold text-orange-800">
                          Unpaid — please settle at the parish cashier
                        </Text>
                      </View>
                    ) : null}

                    <Text className="text-sm text-gray-600 mb-3">{getPaymentConfig(selectedRequest).hint}</Text>

                    <View className="flex-row gap-4 mb-3">
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-gray-500 uppercase">Service Fee</Text>
                        <Text className="text-sm font-bold text-gray-800 mt-1">
                          {getServiceFee(selectedRequest) > 0
                            ? formatPeso(getServiceFee(selectedRequest))
                            : 'Free'}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-gray-500 uppercase">Amount Paid</Text>
                        <Text className="text-sm text-gray-800 mt-1">
                          {formatPeso(getAmountPaidDisplay(selectedRequest))}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row gap-4">
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-gray-500 uppercase">Balance to Pay</Text>
                        <Text
                          className={`text-sm font-bold mt-1 ${
                            getBalanceDue(selectedRequest) > 0 ? 'text-amber-700' : 'text-green-700'
                          }`}
                        >
                          {selectedRequest.status === 'cancelled' || getServiceFee(selectedRequest) <= 0
                            ? (selectedRequest.status === 'cancelled' ? formatPeso(0) : 'None')
                            : formatPeso(getBalanceDue(selectedRequest))}
                        </Text>
                      </View>
                      {selectedRequest.payment_date ? (
                        <View className="flex-1">
                          <Text className="text-xs font-semibold text-gray-500 uppercase">Paid On</Text>
                          <Text className="text-sm text-gray-800 mt-1">
                            {formatDateLong(selectedRequest.payment_date)}
                          </Text>
                        </View>
                      ) : null}
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

                <View className="px-5 py-4 border-t border-gray-200 gap-2">
                  {selectedRequest.status === 'pending' ? (
                    <TouchableOpacity
                      onPress={openCancelModal}
                      disabled={cancelling}
                      className="bg-red-50 border border-red-200 rounded-xl py-3 items-center"
                    >
                      <Text className="text-red-700 font-semibold">Cancel Request</Text>
                    </TouchableOpacity>
                  ) : null}
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

      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!cancelling) setShowCancelModal(false);
        }}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className={`bg-white rounded-2xl w-full ${isCompact ? 'max-w-md' : 'max-w-lg'} p-5`}>
            <Text className="text-lg font-bold text-gray-800 mb-1">Cancel Request</Text>
            <Text className="text-sm text-gray-600 mb-4">
              This will cancel your pending request. Please tell us why.
            </Text>
            <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">Reason *</Text>
            <TextInput
              value={cancelReason}
              onChangeText={(text) => {
                setCancelReason(text);
                if (cancelError) setCancelError('');
              }}
              placeholder="e.g. I need to change the schedule"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className={`border rounded-xl px-3 py-3 text-gray-800 bg-gray-50 min-h-[90px] ${
                cancelError ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {cancelError ? <Text className="text-red-500 text-xs mt-1">{cancelError}</Text> : null}
            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={() => {
                  if (!cancelling) setShowCancelModal(false);
                }}
                disabled={cancelling}
                className="flex-1 py-3 rounded-xl bg-gray-100 items-center"
              >
                <Text className="text-gray-700 font-semibold">Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCancelRequest}
                disabled={cancelling}
                className={`flex-1 py-3 rounded-xl items-center ${cancelling ? 'bg-red-400' : 'bg-red-600'}`}
              >
                {cancelling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Confirm Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
