import React, { useEffect, useState } from 'react';
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

const FALLBACK_MIN_OFFERING = 500;

interface FormData {
  parishioner_name: string;
  intention_text: string;
  intention_date: string;
  preferred_time: string;
  notes: string;
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
    <Modal
      visible={visible}
      transparent
      animationType={isWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
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
                className={`px-5 py-2.5 rounded-xl ${
                  button.style === 'cancel' ? 'bg-gray-100' : 'bg-blue-600'
                }`}
              >
                <Text
                  className={`font-semibold ${
                    button.style === 'cancel' ? 'text-gray-700' : 'text-white'
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

const ErrorMessage = ({ message }: { message?: string }) => {
  if (!message) return null;
  return <Text className="text-red-500 text-xs mt-1">{message}</Text>;
};

export default function SpecialIntentionForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const params = useLocalSearchParams<{ fee?: string }>();

  const [formData, setFormData] = useState<FormData>({
    parishioner_name: '',
    intention_text: '',
    intention_date: '',
    preferred_time: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { bookedSlots } = useBookedTimeSlots(formData.intention_date);
  const initialFee = Number(params.fee);
  const [feeLabel, setFeeLabel] = useState(
    `₱${(Number.isFinite(initialFee) && initialFee > 0 ? initialFee : FALLBACK_MIN_OFFERING).toFixed(2)}`
  );
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

  useEffect(() => {
    if (user?.full_name) {
      setFormData((prev) => ({
        ...prev,
        parishioner_name: prev.parishioner_name || user.full_name,
      }));
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const service = await api.getServiceByName('Special Intention');
        if (service?.fee) {
          setFeeLabel(`₱${Number(service.fee).toFixed(2)}`);
          console.log('Special Intention minimum offering:', service.fee);
        }
      } catch (err) {
        console.error('Failed to load Special Intention fee', err);
      }
    })();
  }, []);

  const showCustomAlert = (title: string, message: string, buttons: CustomAlertButton[]) => {
    setAlertConfig({ title, message, buttons });
    setAlertVisible(true);
  };

  const goBack = () => {
    router.replace('/Parishioner/(protected)/(tabs)/church_service');
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
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
    if (!formData.parishioner_name.trim()) {
      next.parishioner_name = 'Name is required';
    }
    if (!formData.intention_text.trim() || formData.intention_text.trim().length < 5) {
      next.intention_text = 'Please describe your intention (at least 5 characters)';
    }
    if (!formData.intention_date) {
      next.intention_date = 'Date is required';
    }
    if (!formData.preferred_time) {
      next.preferred_time = 'Preferred time is required';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      showCustomAlert('Incomplete Form', 'Please fill in your name, intention, date, and preferred time.', [
        { text: 'OK', onPress: () => {}, style: 'default' },
      ]);
      return;
    }
    if (!user) {
      showCustomAlert('Error', 'Please login first.', [
        { text: 'OK', onPress: () => {}, style: 'default' },
      ]);
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Submitting special intention:', formData);
      const res = await api.createSpecialIntention({
        parishioner_name: formData.parishioner_name.trim(),
        intention_text: formData.intention_text.trim(),
        intention_date: formData.intention_date,
        preferred_time: formData.preferred_time,
        notes: formData.notes.trim() || undefined,
      });

      if (!res.success) {
        throw new Error(res.message || 'Failed to submit special intention');
      }

      showCustomAlert(
        'Request Submitted',
        `Your special intention has been submitted for secretary approval.\n\nDate: ${formData.intention_date}\nTime: ${getDisplayTimeLabel(formData.preferred_time)}\nMinimum offering: ${feeLabel}\nAfter approval, pay at the parish cashier.`,
        [
          {
            text: 'OK',
            onPress: goBack,
            style: 'default',
          },
        ]
      );
    } catch (error: any) {
      console.error('Special intention submit error:', error);
      const message =
        error?.data?.message ||
        error?.message ||
        'Unable to submit. Please try again.';
      showCustomAlert('Submission Failed', message, [
        { text: 'OK', onPress: () => {}, style: 'default' },
      ]);
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
        <Text className="text-xl font-bold text-gray-800">Special Intention</Text>
      </View>

      <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
        <Text className="text-amber-900 font-semibold">Minimum offering: {feeLabel}</Text>
        <Text className="text-amber-800 text-sm mt-1">
          The secretary will review your request first. After approval, pay in cash at the parish cashier.
        </Text>
      </View>

      <View className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Request details
        </Text>

        <View className="mb-3">
          <Text className="text-sm text-gray-600 font-medium mb-1">Your name *</Text>
          <TextInput
            className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
              errors.parishioner_name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g. Althian James"
            placeholderTextColor="#9CA3AF"
            value={formData.parishioner_name}
            onChangeText={(text) => handleChange('parishioner_name', text)}
          />
          <ErrorMessage message={errors.parishioner_name} />
        </View>

        <View className="mb-3">
          <Text className="text-sm text-gray-600 font-medium mb-1">Intention *</Text>
          <TextInput
            className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
              errors.intention_text ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g. I want to be blessed by the church to pass the bar exam"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={formData.intention_text}
            onChangeText={(text) => handleChange('intention_text', text)}
          />
          <ErrorMessage message={errors.intention_text} />
        </View>

        <View className="mb-3">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Preferred schedule
          </Text>
          <ResponsiveRow>
            <View className="flex-1">
              <Text className="text-sm text-gray-600 font-medium mb-1">Date *</Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedMonth(
                    formData.intention_date ? new Date(formData.intention_date) : new Date()
                  );
                  setShowDatePicker(true);
                }}
                className={`border rounded-xl px-4 py-3 bg-gray-50 ${
                  errors.intention_date ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <Text className={formData.intention_date ? 'text-gray-800' : 'text-gray-400'}>
                  {formData.intention_date || 'Select date'}
                </Text>
              </TouchableOpacity>
              <ErrorMessage message={errors.intention_date} />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-gray-600 font-medium mb-1">Preferred time *</Text>
              <TouchableOpacity
                onPress={() => {
                  if (!formData.intention_date) {
                    showCustomAlert('Select Date First', 'Please choose a date before selecting a time.', [
                      { text: 'OK', onPress: () => {}, style: 'default' },
                    ]);
                    return;
                  }
                  setShowTimeDropdown(true);
                }}
                className={`border rounded-xl px-4 py-3 bg-gray-50 ${
                  errors.preferred_time ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <Text className={formData.preferred_time ? 'text-gray-800' : 'text-gray-400'}>
                  {getDisplayTimeLabel(formData.preferred_time)}
                </Text>
              </TouchableOpacity>
              <ErrorMessage message={errors.preferred_time} />
            </View>
          </ResponsiveRow>
        </View>

        <View>
          <Text className="text-sm text-gray-600 font-medium mb-1">Notes (optional)</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-gray-800 bg-gray-50"
            placeholder="Additional notes"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            value={formData.notes}
            onChangeText={(text) => handleChange('notes', text)}
          />
        </View>
      </View>

      <View className="flex-row gap-3 mb-12">
        <TouchableOpacity
          onPress={goBack}
          disabled={isSubmitting}
          className="flex-1 py-3 rounded-xl bg-gray-100"
        >
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
        <ScrollView
          className="px-4 pt-5"
          style={{ height: height - 40 }}
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          {scrollContent}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <ScrollView
            className="flex-1 px-4 pt-5"
            contentContainerStyle={{ paddingBottom: 30 }}
            showsVerticalScrollIndicator={false}
          >
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
              selectedDate={formData.intention_date}
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
                  setFormData((prev) => ({
                    ...prev,
                    intention_date: formatted,
                    preferred_time: '',
                  }));
                  if (errors.intention_date || errors.preferred_time) {
                    setErrors((prev) => ({ ...prev, intention_date: '', preferred_time: '' }));
                  }
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
