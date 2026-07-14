import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { api } from '../../../../library/api';
import ResponsiveContainer from '../../../../components/ResponsiveContainer';
import ResponsiveRow from '../../../../components/ResponsiveRow';
import DatePickerCalendar from '../../../../components/DatePickerCalendar';
import ServiceTimeDropdownModal from '../../../../components/ServiceTimeDropdownModal';
import { useBookedTimeSlots } from '../../../../hooks/useBookedTimeSlots';
import { getDisplayTimeLabel } from '../../../../constants/serviceTimeOptions';

interface FormData {
  full_name: string;
  address: string;
  contact_number: string;
  preferred_date: string;
  preferred_time: string;
}

interface CustomAlertButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

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
  const isWeb = Platform.OS === 'web';
  return (
    <Modal visible={visible} transparent animationType={isWeb ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View
        className="flex-1 justify-center items-center bg-black/50"
        style={isWeb ? ({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } as any) : {}}
      >
        <View className="bg-white rounded-2xl p-6 w-11/12 max-w-sm shadow-lg">
          <Text className="text-xl font-bold text-gray-800 text-center mb-2">{title}</Text>
          <Text className="text-gray-600 text-center text-base mb-6">{message}</Text>
          <View className="flex-row flex-wrap gap-2 justify-center">
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  button.onPress();
                  onClose();
                }}
                className={`px-5 py-2.5 rounded-xl ${button.style === 'cancel' ? 'bg-gray-100' : 'bg-blue-600'}`}
              >
                <Text className={`font-semibold ${button.style === 'cancel' ? 'text-gray-700' : 'text-white'}`}>
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

const ErrorMessage = ({ message }: { message?: string }) => {
  if (!message) return null;
  return <Text className="text-red-500 text-xs mt-1">{message}</Text>;
};

export default function GenericServiceForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const params = useLocalSearchParams<{ serviceId?: string; serviceName?: string; fee?: string }>();

  const serviceId = useMemo(() => Number(params.serviceId || 0), [params.serviceId]);
  const serviceName = params.serviceName || 'Church Service';
  const feeLabel = params.fee ? `₱${Number(params.fee).toFixed(2)}` : null;

  const [formData, setFormData] = useState<FormData>({
    full_name: user?.full_name || '',
    address: user?.address || '',
    contact_number: user?.contact_number || '',
    preferred_date: '',
    preferred_time: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    buttons: CustomAlertButton[];
  }>({ title: '', message: '', buttons: [{ text: 'OK', onPress: () => {}, style: 'default' }] });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const { bookedSlots } = useBookedTimeSlots(formData.preferred_date);

  const showCustomAlert = (title: string, message: string, buttons: CustomAlertButton[]) => {
    setAlertConfig({ title, message, buttons });
    setAlertVisible(true);
  };

  const goBack = () => router.replace('/Parishioner/(protected)/(tabs)/church_service');

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const isDateDisabled = (year: number, month: number, day: number) => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const checkDate = new Date(year, month, day);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < todayDate;
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!formData.full_name.trim()) next.full_name = 'Full name is required';
    if (!formData.address.trim() || formData.address.trim().length < 5) {
      next.address = 'Please enter a complete address';
    }
    if (!formData.preferred_date) next.preferred_date = 'Date is required';
    if (!formData.preferred_time) next.preferred_time = 'Time is required';
    else if (bookedSlots.includes(formData.preferred_time)) {
      next.preferred_time = 'This time is already booked';
    }
    if (!/^09\d{9}$/.test(formData.contact_number)) {
      next.contact_number = 'Enter 11-digit PH number (e.g., 09123456789)';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      showCustomAlert('Incomplete Form', 'Please fill up the required information before submitting', [
        { text: 'OK', onPress: () => {}, style: 'default' },
      ]);
      return;
    }
    if (!user || !serviceId) {
      showCustomAlert('Error', 'Missing service or login session.', [
        { text: 'OK', onPress: () => {}, style: 'default' },
      ]);
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Submitting generic service request:', serviceName, serviceId, formData);
      const serviceFormResponse = await api.createServiceForm({
        service_id: serviceId,
        full_name: formData.full_name,
        address: formData.address,
        contact_number: formData.contact_number,
        preferred_date: formData.preferred_date,
        preferred_time: formData.preferred_time,
      });
      if (!serviceFormResponse.success) {
        throw new Error(serviceFormResponse.message || 'Failed to create service form');
      }

      const requestResponse = await api.createRequest({
        user_id: user.user_id,
        service_id: serviceId,
        service_form_id: serviceFormResponse.data.serviceform_id,
      });
      if (!requestResponse.success) {
        throw new Error(requestResponse.message || 'Failed to create request');
      }

      showCustomAlert(
        'Request Submitted!',
        `Your ${serviceName} request was submitted.\n\nDate: ${formData.preferred_date}\nTime: ${getDisplayTimeLabel(formData.preferred_time)}`,
        [{ text: 'OK', onPress: goBack, style: 'default' }]
      );
    } catch (error: any) {
      console.error('Generic service submit error:', error);
      showCustomAlert(
        'Submission Failed',
        error?.data?.message || error?.message || 'Unable to submit. Please try again.',
        [{ text: 'OK', onPress: () => {}, style: 'default' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollContent = (
    <ResponsiveContainer>
      <View className="flex-row items-center mb-4">
        <TouchableOpacity onPress={goBack} className="p-2 mr-2">
          <Feather name="arrow-left" size={22} color="#1F2937" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-800 flex-1">{serviceName}</Text>
      </View>

      {feeLabel && (
        <View className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
          <Text className="text-blue-900 font-semibold">Service fee: {feeLabel}</Text>
          <Text className="text-blue-800 text-sm mt-1">Pay in cash at the parish cashier after approval.</Text>
        </View>
      )}

      <View className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Requester</Text>
        <View className="mb-3">
          <Text className="text-sm text-gray-600 font-medium mb-1">Full name *</Text>
          <TextInput
            className={`border rounded-xl px-4 py-3 bg-gray-50 ${errors.full_name ? 'border-red-500' : 'border-gray-300'}`}
            value={formData.full_name}
            onChangeText={(t) => handleChange('full_name', t)}
          />
          <ErrorMessage message={errors.full_name} />
        </View>
        <View className="mb-3">
          <Text className="text-sm text-gray-600 font-medium mb-1">Address *</Text>
          <TextInput
            className={`border rounded-xl px-4 py-3 bg-gray-50 ${errors.address ? 'border-red-500' : 'border-gray-300'}`}
            multiline
            value={formData.address}
            onChangeText={(t) => handleChange('address', t)}
          />
          <ErrorMessage message={errors.address} />
        </View>
        <View>
          <Text className="text-sm text-gray-600 font-medium mb-1">Contact Number *</Text>
          <TextInput
            className={`border rounded-xl px-4 py-3 bg-gray-50 ${errors.contact_number ? 'border-red-500' : 'border-gray-300'}`}
            keyboardType={isWeb ? 'default' : 'phone-pad'}
            maxLength={11}
            value={formData.contact_number}
            onChangeText={(t) => handleChange('contact_number', t.replace(/\D/g, '').slice(0, 11))}
          />
          <ErrorMessage message={errors.contact_number} />
        </View>
      </View>

      <View className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Schedule</Text>
        <ResponsiveRow>
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">Date *</Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedMonth(formData.preferred_date ? new Date(formData.preferred_date) : new Date());
                setShowDatePicker(true);
              }}
              className={`border rounded-xl px-4 py-3 bg-gray-50 ${errors.preferred_date ? 'border-red-500' : 'border-gray-300'}`}
            >
              <Text className={formData.preferred_date ? 'text-gray-800' : 'text-gray-400'}>
                {formData.preferred_date || 'Select date'}
              </Text>
            </TouchableOpacity>
            <ErrorMessage message={errors.preferred_date} />
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">Time *</Text>
            <TouchableOpacity
              onPress={() => setShowTimeDropdown(true)}
              className={`border rounded-xl px-4 py-3 bg-gray-50 ${errors.preferred_time ? 'border-red-500' : 'border-gray-300'}`}
            >
              <Text className={formData.preferred_time ? 'text-gray-800' : 'text-gray-400'}>
                {getDisplayTimeLabel(formData.preferred_time)}
              </Text>
            </TouchableOpacity>
            <ErrorMessage message={errors.preferred_time} />
          </View>
        </ResponsiveRow>
      </View>

      <View className="flex-row gap-3 mb-12">
        <TouchableOpacity onPress={goBack} className="flex-1 py-3 rounded-xl bg-gray-100">
          <Text className="text-gray-600 text-center text-sm font-semibold">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          className={`flex-1 py-3 rounded-xl ${isSubmitting ? 'bg-blue-400' : 'bg-blue-600'}`}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center text-sm font-semibold">Submit Request</Text>
          )}
        </TouchableOpacity>
      </View>
    </ResponsiveContainer>
  );

  return (
    <View className="flex-1 bg-gray-50" style={isWeb ? { height } : { flex: 1 }}>
      <StatusBar style="dark" />
      {isWeb ? (
        <ScrollView className="px-4 pt-5" style={{ height: height - 40 }} contentContainerStyle={{ paddingBottom: 30 }}>
          {scrollContent}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <ScrollView className="flex-1 px-4 pt-5" contentContainerStyle={{ paddingBottom: 30 }}>
            {scrollContent}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />

      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-4" style={{ maxHeight: '90%' }}>
            <View className="flex-row justify-between items-center mb-4 px-2">
              <Text className="text-xl font-bold text-gray-800">Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} className="p-2">
                <Feather name="x" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <DatePickerCalendar
              selectedMonth={selectedMonth}
              selectedDate={formData.preferred_date}
              onMonthChange={(inc: number) =>
                setSelectedMonth((prev) => {
                  const next = new Date(prev);
                  next.setMonth(prev.getMonth() + inc);
                  return next;
                })
              }
              onDateSelect={(day: number) => {
                const year = selectedMonth.getFullYear();
                const month = selectedMonth.getMonth();
                if (!isDateDisabled(year, month, day)) {
                  const formatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  setFormData((prev) => ({ ...prev, preferred_date: formatted, preferred_time: '' }));
                  setShowDatePicker(false);
                }
              }}
              isDateDisabled={isDateDisabled}
            />
          </View>
        </View>
      </Modal>

      <ServiceTimeDropdownModal
        visible={showTimeDropdown}
        selectedValue={formData.preferred_time}
        bookedSlots={bookedSlots}
        onSelect={(value) => handleChange('preferred_time', value)}
        onClose={() => setShowTimeDropdown(false)}
      />
    </View>
  );
}
