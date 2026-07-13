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
import { FontAwesome5 } from '@expo/vector-icons';
import { api } from '../../../../library/api';
import ResponsiveContainer from '../../../../components/ResponsiveContainer';
import ResponsiveGrid from '../../../../components/ResponsiveGrid';
import ParishionerHeader from '../../../../components/ParishionerHeader';
import { useResponsive } from '../../../../hooks/useResponsive';

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
const getServiceIcon = (name: string): { name: keyof typeof FontAwesome5.glyphMap; color: string } => {
  const lower = name.toLowerCase();
  if (lower.includes('baptism') && !lower.includes('certificate')) return { name: 'tint', color: '#2563EB' };
  if (lower.includes('funeral')) return { name: 'cross', color: '#2563EB' };
  if (lower.includes('marriage') && !lower.includes('certificate')) return { name: 'ring', color: '#2563EB' };
  if (lower.includes('house blessing') || lower.includes('house')) return { name: 'home', color: '#2563EB' };
  if (lower.includes('certificate')) return { name: 'file-alt', color: '#2563EB' };
  return { name: 'church', color: '#2563EB' };
};

const getCertificateIcon = (title: string): { name: keyof typeof FontAwesome5.glyphMap; color: string } => {
  const lower = title.toLowerCase();
  if (lower.includes('baptismal')) return { name: 'file-alt', color: '#2563EB' };
  if (lower.includes('marriage')) return { name: 'file-signature', color: '#2563EB' };
  return { name: 'file-alt', color: '#2563EB' };
};

// ============================================================
// COLOR HELPERS — unified blue/white for responsive layout
// ============================================================
const getServiceColors = () => ({
  bg: 'bg-white',
  border: 'border-blue-200',
  text: 'text-blue-600',
  button: 'bg-blue-600',
});

const getCertificateColors = () => ({
  bg: 'bg-white',
  border: 'border-blue-200',
  text: 'text-blue-600',
  button: 'bg-blue-600',
});

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function ChurchService() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialView = params.initialView as string;
  const { isCompact } = useResponsive();

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
      <ParishionerHeader title="Church Services" subtitle="Parishioner Portal" />

      <ResponsiveContainer noPadding>
        {/* TITLE */}
        <View className="pt-6 pb-4">
          <Text className={`font-bold text-gray-800 text-center ${isCompact ? 'text-2xl' : 'text-3xl'}`}>
            Church Services
          </Text>
          <Text className="text-base text-gray-500 text-center mt-1">
            Choose from our available services below
          </Text>
        </View>

        {/* TAB NAVIGATION */}
        <View className="pb-4">
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
      </ResponsiveContainer>

      {/* CARDS GRID */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ResponsiveContainer>
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
          <ResponsiveGrid>
            {items.map((item) => {
              if (isService(item)) {
                const service = item;
                const colors = getServiceColors();
                const serviceIcon = getServiceIcon(service.name);
                const isAvailable = service.isAvailable !== false;
                const remainingSlots = getRemainingSlots(service.slotsRemaining);
                const hasSlots = remainingSlots > 0;

                return (
                  <View
                    key={service.id}
                    className={`${colors.bg} border ${colors.border} rounded-2xl p-4 shadow-sm ${
                      isAvailable && hasSlots ? '' : 'opacity-60'
                    }`}
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center">
                        <FontAwesome5 name={serviceIcon.name} size={18} color={serviceIcon.color} />
                      </View>
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
                const colors = getCertificateColors();
                const certIcon = getCertificateIcon(certificate.title);

                return (
                  <View
                    key={certificate.id}
                    className={`${colors.bg} border ${colors.border} rounded-2xl p-4 shadow-sm`}
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center">
                        <FontAwesome5 name={certIcon.name} size={18} color={certIcon.color} />
                      </View>
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
          </ResponsiveGrid>
        )}
        <View className="h-8" />
        </ResponsiveContainer>
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