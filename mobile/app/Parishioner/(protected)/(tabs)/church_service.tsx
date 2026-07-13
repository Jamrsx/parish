import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../../../library/api';

// ============================================================
// INTERFACES
// ============================================================
interface ServiceAvailability {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: string;
  statusColor: string;
  slotsRemaining: string;
  nextDate: string;
  progress: number;
  buttonText: string;
  disabled: boolean;
  navigateTo: string;
  isAvailable: boolean;
  remainingSlots: number;
  dailyLimit: number;
}

interface CertificateAvailability {
  id: number;
  title: string;
  description: string;
  processingTime: string;
  timeColor: string;
  navigateTo: string;
}

interface CustomAlertButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

// CUSTOM ALERT COMPONENT 
const CustomAlert = ({
  visible,
  title,
  message,
  buttons = [{ text: 'OK', onPress: () => {}, style: 'default' }],
  onClose,
}: {
  visible: boolean;
  title: string;
  message: string;
  buttons?: CustomAlertButton[];
  onClose: () => void;
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white rounded-2xl p-6 w-11/12 max-w-sm shadow-lg">
          <Text className="text-xl font-bold text-gray-800 text-center mb-2">
            {title}
          </Text>
          <Text className="text-gray-600 text-center text-base mb-6">
            {message}
          </Text>
          <View className="flex-row flex-wrap gap-2 justify-center">
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  button.onPress();
                  onClose();
                }}
                className={`px-6 py-3 rounded-xl min-w-[100px] ${
                  button.style === 'cancel'
                    ? 'bg-gray-200'
                    : button.style === 'destructive'
                    ? 'bg-red-600'
                    : 'bg-blue-600'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    button.style === 'cancel'
                      ? 'text-gray-700'
                      : 'text-white'
                  }`}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// ICON HELPERS
// ============================================================
const getServiceEmoji = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('baptism') && !lower.includes('certificate')) return '💧';
  if (lower.includes('funeral')) return '✝️';
  if (lower.includes('marriage') && !lower.includes('certificate')) return '💎';
  if (lower.includes('house blessing') || lower.includes('house')) return '🏠';
  if (lower.includes('certificate')) return '📄';
  return '❤️';
};

const getCertificateEmoji = (title: string): string => {
  const lower = title.toLowerCase();
  if (lower.includes('baptismal')) return '📄';
  if (lower.includes('marriage')) return '💎';
  return '📄';
};

// ============================================================
// COLOR HELPERS
// ============================================================
const getServiceColors = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('baptism') && !lower.includes('certificate')) {
    return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', button: 'bg-blue-600' };
  }
  if (lower.includes('funeral')) {
    return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', button: 'bg-purple-600' };
  }
  if (lower.includes('marriage') && !lower.includes('certificate')) {
    return { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-600', button: 'bg-pink-600' };
  }
  if (lower.includes('house blessing') || lower.includes('house')) {
    return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', button: 'bg-green-600' };
  }
  if (lower.includes('certificate')) {
    return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', button: 'bg-amber-600' };
  }
  return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', button: 'bg-gray-600' };
};

const getCertificateColors = (title: string) => {
  const lower = title.toLowerCase();
  if (lower.includes('baptismal')) {
    return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', button: 'bg-blue-600' };
  }
  if (lower.includes('marriage')) {
    return { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-600', button: 'bg-pink-600' };
  }
  return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', button: 'bg-amber-600' };
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function ChurchService() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialView = params.initialView as string;

  // ============ STATE ============
  const [activeTab, setActiveTab] = useState<'services' | 'certificates'>('services');
  const [services, setServices] = useState<ServiceAvailability[]>([]);
  const [certificates, setCertificates] = useState<CertificateAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    buttons: CustomAlertButton[];
  }>({
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: () => {}, style: 'default' }],
  });

  // Track the selected date
  const [selectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    if (initialView === 'services') {
      setActiveTab('services');
    } else if (initialView === 'records') {
      setActiveTab('certificates');
    }
  }, [initialView]);

  // SHOW CUSTOM ALERT
  const showCustomAlert = (title: string, message: string, buttons: CustomAlertButton[]) => {
    setAlertConfig({ title, message, buttons });
    setAlertVisible(true);
  };

  // API CALLS
  const fetchAvailability = useCallback(async (date?: string) => {
    try {
      setLoading(true);
      const dateToUse = date || selectedDate;
      const response = await api.getAvailability(dateToUse);

      if (response.success) {
        const correctedServices = response.data.services.map((service: ServiceAvailability) => {
          const pathMap: Record<string, string> = {
            Baptism: '/Parishioner/(protected)/forms_request/BaptismForm',
            'Funeral Mass': '/Parishioner/(protected)/forms_request/FuneralMassForm',
            'House Blessing': '/Parishioner/(protected)/forms_request/HouseBlessingsForm',
            Marriage: '/Parishioner/(protected)/forms_request/MarriageInquiryForm',
          };
          return {
            ...service,
            navigateTo: pathMap[service.name] || service.navigateTo,
          };
        });

        const filteredCertificates = response.data.certificates.filter(
          (cert: CertificateAvailability) => cert.title !== 'Confirmation Certificate'
        );

        setServices(correctedServices);
        setCertificates(filteredCertificates);
        setError(null);
      } else {
        setError('Failed to load service availability');
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
      setError('Unable to load services. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAvailability(selectedDate);
  };

  // HANDLERS
  const handleTabChange = (tab: 'services' | 'certificates') => {
    setActiveTab(tab);
  };

  const handleServiceSelect = (service: ServiceAvailability) => {
    if (service.disabled) {
      showCustomAlert(
        'Fully Booked',
        `Sorry, ${service.name} is fully booked. Next available: ${service.nextDate}`,
        [{ text: 'OK', onPress: () => {}, style: 'default' }]
      );
      return;
    }

    if (service.navigateTo) {
      router.push({
        pathname: service.navigateTo as any,
        params: { 
          serviceId: service.id,
          serviceName: service.name 
        }
      });
    } else {
      showCustomAlert(
        'Error',
        `Unsupported service type: ${service.name}`,
        [{ text: 'OK', onPress: () => {}, style: 'default' }]
      );
    }
  };

  const handleCertificateSelect = (certificate: CertificateAvailability) => {
    const pathMap: Record<string, string> = {
      'Baptismal Certificate': '/Parishioner/(protected)/certificate_request/BaptismalCertificate',
      'Marriage Certificate': '/Parishioner/(protected)/certificate_request/MarriageCertificate',
    };
    
    if (pathMap[certificate.title]) {
      router.push({
        pathname: pathMap[certificate.title] as any,
        params: { 
          serviceId: certificate.id.toString(),
          certificateTitle: certificate.title 
        }
      });
    } else {
      showCustomAlert(
        'Error',
        `Unsupported certificate type: ${certificate.title}`,
        [{ text: 'OK', onPress: () => {}, style: 'default' }]
      );
    }
  };

  // HELPERS
  const getRemainingSlots = (slotsRemaining: string): number => {
    if (!slotsRemaining) return 0;
    if (slotsRemaining.includes('/')) {
      const parts = slotsRemaining.split('/');
      return parseInt(parts[0]) || 0;
    }
    return parseInt(slotsRemaining) || 0;
  };

  // LOADING
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="mt-4 text-gray-500">Loading services...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ERROR
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-red-600 text-center mb-4">{error}</Text>
          <TouchableOpacity 
            onPress={() => fetchAvailability(selectedDate)} 
            className="bg-blue-600 px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // SERVICE SELECTION VIEW
  const items = activeTab === 'services' ? services : certificates;
  const isEmpty = items.length === 0;

  const isService = (item: any): item is ServiceAvailability => {
    return 'name' in item && 'slotsRemaining' in item;
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      {/* HEADER */}
      <View className="bg-white px-5 py-4 border-b border-gray-200">
        <View className="flex-row items-center">
          <View className="w-12 h-12 rounded-full overflow-hidden border border-gray-200 bg-blue-100 items-center justify-center">
            <Text className="text-2xl">⛪</Text>
          </View>
          <View className="ml-3">
            <Text className="text-xl font-bold text-gray-800">Church Services</Text>
            <Text className="text-xs text-gray-500">Parishioner Portal</Text>
          </View>
        </View>
      </View>

      {/* TITLE */}
      <View className="px-5 pt-6 pb-4">
        <Text className="text-3xl font-bold text-gray-800 text-center">Church Services</Text>
        <Text className="text-base text-gray-500 text-center mt-1">
          Choose from our available services below
        </Text>
      </View>

      {/* TAB NAVIGATION */}
      <View className="px-5 pb-4">
        <View className="flex-row bg-gray-100 rounded-lg p-1">
          <TouchableOpacity
            onPress={() => handleTabChange('services')}
            className={`flex-1 py-2.5 rounded-md ${
              activeTab === 'services' ? 'bg-white' : ''
            }`}
          >
            <Text className={`text-center font-medium ${activeTab === 'services' ? 'text-blue-600' : 'text-gray-600'}`}>
              Services
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleTabChange('certificates')}
            className={`flex-1 py-2.5 rounded-md ${
              activeTab === 'certificates' ? 'bg-white' : ''
            }`}
          >
            <Text className={`text-center font-medium ${activeTab === 'certificates' ? 'text-blue-600' : 'text-gray-600'}`}>
              Certificates
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CARDS GRID */}
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isEmpty ? (
          <View className="py-12 items-center">
            <Text className="text-gray-500">
              {activeTab === 'services' ? 'No services available at the moment.' : 'No certificates available at the moment.'}
            </Text>
            <TouchableOpacity 
              onPress={() => fetchAvailability(selectedDate)} 
              className="mt-4 bg-blue-600 px-6 py-2 rounded-lg"
            >
              <Text className="text-white font-medium">Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="pb-6 flex-row flex-wrap justify-between">
            {items.map((item) => {
              if (isService(item)) {
                const service = item;
                const colors = getServiceColors(service.name);
                const isAvailable = service.isAvailable !== false;
                const remainingSlots = getRemainingSlots(service.slotsRemaining);
                const hasSlots = remainingSlots > 0;

                return (
                  <View
                    key={service.id}
                    className={`w-[48%] ${colors.bg} border ${colors.border} rounded-2xl p-4 mb-4 shadow-sm ${
                      isAvailable && hasSlots ? '' : 'opacity-60'
                    }`}
                  >
                    <View className="flex-row justify-between items-start">
                      <Text className="text-3xl">{getServiceEmoji(service.name)}</Text>
                      <View
                        className={`px-2 py-1 rounded-full ${
                          isAvailable && hasSlots ? 'bg-green-100' : 'bg-red-100'
                        }`}
                      >
                        <Text
                          className={`text-xs font-medium ${
                            isAvailable && hasSlots ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {isAvailable && hasSlots ? 'Available' : 'Unavailable'}
                        </Text>
                      </View>
                    </View>

                    <Text className="text-lg font-bold text-gray-800 mt-2">{service.name}</Text>
                    <Text className="text-sm text-gray-500 mt-1" numberOfLines={2}>
                      {service.description || 'Service description'}
                    </Text>

                    <View className="mt-3 space-y-1">
                      {service.dailyLimit && (
                        <View className="flex-row justify-between">
                          <Text className="text-xs text-gray-500">Daily Limit</Text>
                          <Text className="text-xs font-semibold text-gray-800">{service.dailyLimit}</Text>
                        </View>
                      )}
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-gray-500">Next Available</Text>
                        <Text className="text-xs font-semibold text-gray-800">{service.nextDate}</Text>
                      </View>
                      {hasSlots && (
                        <View className="flex-row justify-between border-t border-gray-100 pt-1 mt-1">
                          <Text className="text-xs text-green-500">Slots Remaining</Text>
                          <Text className="text-xs font-medium text-green-600">{remainingSlots} slots</Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => handleServiceSelect(service)}
                      disabled={!isAvailable || !hasSlots}
                      className={`mt-4 py-3 rounded-lg ${
                        isAvailable && hasSlots ? colors.button : 'bg-gray-300'
                      }`}
                    >
                      <Text className={`text-center font-medium ${isAvailable && hasSlots ? 'text-white' : 'text-gray-500'}`}>
                        {isAvailable && hasSlots ? 'Start Request' : 'Not Available'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              } else {
                const certificate = item as CertificateAvailability;
                const colors = getCertificateColors(certificate.title);

                return (
                  <View
                    key={certificate.id}
                    className={`w-[48%] ${colors.bg} border ${colors.border} rounded-2xl p-4 mb-4 shadow-sm`}
                  >
                    <View className="flex-row justify-between items-start">
                      <Text className="text-3xl">{getCertificateEmoji(certificate.title)}</Text>
                      <View className="px-2 py-1 rounded-full bg-green-100">
                        <Text className="text-xs font-medium text-green-700">Available</Text>
                      </View>
                    </View>

                    <Text className="text-lg font-bold text-gray-800 mt-2">{certificate.title}</Text>
                    <Text className="text-sm text-gray-500 mt-1" numberOfLines={2}>
                      {certificate.description}
                    </Text>

                    <View className="mt-3">
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-gray-500">Processing Time</Text>
                        <Text className="text-xs font-semibold text-gray-800">{certificate.processingTime}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleCertificateSelect(certificate)}
                      className={`mt-4 py-3 rounded-lg ${colors.button}`}
                    >
                      <Text className="text-white text-center font-medium">Request Certificate</Text>
                    </TouchableOpacity>
                  </View>
                );
              }
            })}
          </View>
        )}
        <View className="h-8" />
      </ScrollView>

      {/* Custom Alert Modal */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}