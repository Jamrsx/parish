import React, { useState } from 'react';
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
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { api } from '../../../../library/api';
import ResponsiveContainer from '../../../../components/ResponsiveContainer';
import ResponsiveRow from '../../../../components/ResponsiveRow';
import DatePickerCalendar from '../../../../components/DatePickerCalendar';
import { useResponsive } from '../../../../hooks/useResponsive';


interface MarriageCertificateData {
  husband_name: string;
  wife_name: string;
  marriage_date: string;
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

// ============================================================
// CUSTOM ALERT COMPONENT - Android Only
// ============================================================
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

const today = new Date().toISOString().split('T')[0];

const ErrorMessage = ({ message }: { message?: string }) => {
  if (!message) return null;
  return <Text className="text-red-500 text-xs mt-1">{message}</Text>;
};

const SectionCard = ({ children, title }: { children: React.ReactNode; title?: string }) => {
  return (
    <View className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
      {title && (
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {title}
        </Text>
      )}
      {children}
    </View>
  );
};

// Time options
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

// Time Dropdown Modal Component
const TimeDropdownModal = ({
  visible,
  selectedValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl p-4 max-h-[60%]">
          <View className="flex-row justify-between items-center mb-4 px-4">
            <Text className="text-xl font-bold text-gray-800">Select Time</Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-2xl text-gray-500">✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={timeOptions}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                className={`py-4 px-4 rounded-xl mb-1 ${
                  selectedValue === item.value ? 'bg-blue-500' : 'bg-gray-50'
                }`}
              >
                <Text
                  className={`text-center text-base font-medium ${
                    selectedValue === item.value ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      </View>
    </Modal>
  );
};

export default function MarriageCertificate() {
  const router = useRouter();
  const { user } = useAuth();
  const { isWeb, height } = useResponsive();

  const [formData, setFormData] = useState<MarriageCertificateData>({
    husband_name: '',
    wife_name: '',
    marriage_date: '',
    address: '',
    contact_number: '',
    preferred_date: today,
    preferred_time: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Alert states
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

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [activeDateField, setActiveDateField] = useState<'preferred_date' | 'marriage_date'>('preferred_date');

  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  const goToChurchService = () => {
    router.replace('/Parishioner/(protected)/(tabs)/church_service');
  };

  // Show custom alert
  const showCustomAlert = (title: string, message: string, buttons: CustomAlertButton[]) => {
    setAlertConfig({ title, message, buttons });
    setAlertVisible(true);
  };

  // Calendar functions
  const isDateDisabled = (year: number, month: number, day: number): boolean => {
    const checkDate = new Date(year, month, day);
    checkDate.setHours(0, 0, 0, 0);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    if (activeDateField === 'preferred_date') {
      return checkDate < todayDate;
    } else {
      return checkDate > todayDate;
    }
  };

  const handleDateSelect = (day: number) => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    if (!isDateDisabled(year, month, day)) {
      const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      handleChange(activeDateField, formattedDate);
      setShowDatePicker(false);
    }
  };

  const changeMonth = (increment: number) => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + increment);
      return newDate;
    });
  };

  const getDisplayTime = (time24Hour: string): string => {
    if (!time24Hour) return 'Select time';
    const option = timeOptions.find(t => t.value === time24Hour);
    return option ? option.label : 'Select time';
  };

  // Validation
  const validateAllFields = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    // Validate Husband Name
    if (!formData.husband_name.trim()) {
      newErrors.husband_name = "Husband's name is required";
      isValid = false;
    } else if (formData.husband_name.trim().length < 2) {
      newErrors.husband_name = 'Please enter a valid name';
      isValid = false;
    }

    // Validate Wife Name
    if (!formData.wife_name.trim()) {
      newErrors.wife_name = "Wife's name is required";
      isValid = false;
    } else if (formData.wife_name.trim().length < 2) {
      newErrors.wife_name = 'Please enter a valid name';
      isValid = false;
    }

    if (!formData.marriage_date) {
      newErrors.marriage_date = 'Marriage date is required';
      isValid = false;
    }
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
      isValid = false;
    } else if (formData.address.trim().length < 5) {
      newErrors.address = 'Please enter a complete address';
      isValid = false;
    }
    if (!formData.contact_number.trim()) {
      newErrors.contact_number = 'Contact number is required';
      isValid = false;
    } else {
      const phoneRegex = /^(09|\+639)\d{9}$/;
      if (!phoneRegex.test(formData.contact_number.trim().replace(/\s/g, ''))) {
        newErrors.contact_number = 'Enter valid PH number (e.g., 09123456789)';
        isValid = false;
      }
    }
    if (!formData.preferred_date) {
      newErrors.preferred_date = 'Request date is required';
      isValid = false;
    }
    if (!formData.preferred_time) {
      newErrors.preferred_time = 'Time is required';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleChange = (field: keyof MarriageCertificateData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // ============================================================
  // SUBMIT - FIXED
  // ============================================================
  const handleSubmit = async () => {
    if (!validateAllFields()) {
      showCustomAlert(
        'Incomplete Form',
        'Please fill up the required Information before submitting',
        [{ text: 'OK', onPress: () => {}, style: 'default' }]
      );
      return;
    }

    if (!user) {
      showCustomAlert(
        'Error',
        'Please login first.',
        [{ text: 'OK', onPress: () => {}, style: 'default' }]
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // ✅ STEP 1: Get Marriage Certificate service ID first
      const certificateService = await api.getServiceByName('Marriage Certificate');

      if (!certificateService) {
        throw new Error('Marriage Certificate service not found');
      }

      const couple_names = `${formData.husband_name} & ${formData.wife_name}`;

      // ✅ STEP 2: Create certificate form with service_id
      const certificateResponse = await api.createCertificateForm({
        service_id: certificateService.service_id,
        full_name: couple_names,
        marriage_date: formData.marriage_date,
        address: formData.address,
        contact_number: formData.contact_number,
        preferred_date: formData.preferred_date,
        preferred_time: formData.preferred_time,
      });

      if (!certificateResponse.success) {
        throw new Error(certificateResponse.message || 'Failed to create certificate form');
      }

      const certificateId = certificateResponse.data.certificate_id;

      // ✅ STEP 3: Create the request
      const requestResponse = await api.createRequest({
        user_id: user.user_id,
        service_id: certificateService.service_id,
        certificate_form_id: certificateId,
      });

      if (!requestResponse.success) {
        throw new Error(requestResponse.message || 'Failed to create request');
      }

      setIsSubmitting(false);

      showCustomAlert(
        'Request Submitted!',
        `Your Marriage Certificate request has been submitted successfully!\n\nHusband: ${formData.husband_name}\nWife: ${formData.wife_name}\nMarriage Date: ${formData.marriage_date}\nRequest Date: ${formData.preferred_date}\nTime: ${getDisplayTime(formData.preferred_time)}`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              router.replace('/Parishioner/(protected)/(tabs)/church_service');
            },
            style: 'default'
          }
        ]
      );

    } catch (error: any) {
      console.error('Marriage Certificate submission error:', error);
      setIsSubmitting(false);

      let errorMessage = 'Something went wrong. Please try again.';
      
      if (error.data && error.data.message) {
        errorMessage = error.data.message;
        
        if (errorMessage.toLowerCase().includes('no available slots') && error.data.data) {
          if (error.data.data.next_available_date) {
            errorMessage = `No available slots for the selected date.\n\nNext available: ${error.data.data.next_available_date}\nRemaining slots: ${error.data.data.remaining_slots || 0} / ${error.data.data.daily_limit || 0}`;
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      showCustomAlert(
        'Submission Failed',
        errorMessage,
        [
          { 
            text: 'Try Again', 
            onPress: () => {},
            style: 'default'
          },
          { 
            text: 'Cancel', 
            onPress: () => {
              router.replace('/Parishioner/(protected)/(tabs)/church_service');
            },
            style: 'cancel'
          }
        ]
      );
    }
  };

  const scrollContent = (
    <ResponsiveContainer>
    <>
      {/* Header */}
      <View className="flex-row items-center gap-3 mb-6">
        <TouchableOpacity 
          onPress={goToChurchService} 
          className="w-9 h-9 items-center justify-center rounded-full border border-gray-200 bg-white"
        >
          <Feather name="arrow-left" size={18} color="#6B7280" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold text-gray-800">Marriage Certificate Form</Text>
          <Text className="text-xs text-gray-400">Fill in all required fields</Text>
        </View>
      </View>

      {/* Couple Information */}
      <SectionCard title="Couple's Information">
        <ResponsiveRow className="mb-3">
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">Husband&apos;s Name *</Text>
            <TextInput
              className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
                errors.husband_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter husband's full name"
              placeholderTextColor="#9CA3AF"
              value={formData.husband_name}
              onChangeText={text => handleChange('husband_name', text)}
            />
            <ErrorMessage message={errors.husband_name} />
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">Wife&apos;s Name *</Text>
            <TextInput
              className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
                errors.wife_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter wife's full name"
              placeholderTextColor="#9CA3AF"
              value={formData.wife_name}
              onChangeText={text => handleChange('wife_name', text)}
            />
            <ErrorMessage message={errors.wife_name} />
          </View>
        </ResponsiveRow>

        <View className="mb-3">
          <Text className="text-sm text-gray-600 font-medium mb-1">Marriage Date *</Text>
          <TouchableOpacity
            onPress={() => {
              setActiveDateField('marriage_date');
              setSelectedMonth(formData.marriage_date ? new Date(formData.marriage_date) : new Date());
              setShowDatePicker(true);
            }}
            className={`border rounded-xl px-4 py-3 bg-gray-50 ${
              errors.marriage_date ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <Text className={formData.marriage_date ? 'text-gray-800' : 'text-gray-400'}>
              {formData.marriage_date || 'Select marriage date'}
            </Text>
          </TouchableOpacity>
          <ErrorMessage message={errors.marriage_date} />
        </View>

        <View className="mb-3">
          <Text className="text-sm text-gray-600 font-medium mb-1">Address *</Text>
          <TextInput
            className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
              errors.address ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter complete address"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            value={formData.address}
            onChangeText={text => handleChange('address', text)}
          />
          <ErrorMessage message={errors.address} />
        </View>

        <View>
          <Text className="text-sm text-gray-600 font-medium mb-1">Contact Number *</Text>
          <TextInput
            className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
              errors.contact_number ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="09XX XXX XXXX"
            placeholderTextColor="#9CA3AF"
            keyboardType={isWeb ? 'default' : 'phone-pad'}
            value={formData.contact_number}
            onChangeText={text => handleChange('contact_number', text)}
          />
          <ErrorMessage message={errors.contact_number} />
        </View>
      </SectionCard>

      {/* Request Details */}
      <SectionCard title="Request Details">
        <ResponsiveRow>
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">Request Date *</Text>
            <TouchableOpacity
              onPress={() => {
                setActiveDateField('preferred_date');
                setSelectedMonth(formData.preferred_date ? new Date(formData.preferred_date) : new Date());
                setShowDatePicker(true);
              }}
              className={`border rounded-xl px-4 py-3 bg-gray-50 ${
                errors.preferred_date ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <Text className={formData.preferred_date ? 'text-gray-800' : 'text-gray-400'}>
                {formData.preferred_date || 'Select date'}
              </Text>
            </TouchableOpacity>
            <ErrorMessage message={errors.preferred_date} />
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">Preferred Time *</Text>
            <TouchableOpacity
              onPress={() => setShowTimeDropdown(true)}
              className={`border rounded-xl px-4 py-3 bg-gray-50 ${
                errors.preferred_time ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <Text className={formData.preferred_time ? 'text-gray-800' : 'text-gray-400'}>
                {getDisplayTime(formData.preferred_time)}
              </Text>
            </TouchableOpacity>
            <ErrorMessage message={errors.preferred_time} />
          </View>
        </ResponsiveRow>
      </SectionCard>

      {/* Actions */}
      <ResponsiveRow className="mt-2 mb-12">
        <TouchableOpacity
          onPress={goToChurchService}
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
            <Text className="text-white text-center text-sm font-semibold">Request Certificate</Text>
          )}
        </TouchableOpacity>
      </ResponsiveRow>
    </>
    </ResponsiveContainer>
  );

  return (
    <View className="flex-1 bg-gray-50" style={isWeb ? { height: height } : { flex: 1 }}>
      <View className="flex-1" style={isWeb ? { height: height, overflow: 'hidden' } : { flex: 1 }}>
        <StatusBar style="dark" />
        
        {isWeb ? (
          <ScrollView 
            className="px-4 pt-5" 
            showsVerticalScrollIndicator={true}
            style={{ height: height - 60 }}
            contentContainerStyle={{ paddingBottom: 30 }}
          >
            {scrollContent}
          </ScrollView>
        ) : (
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            className="flex-1"
          >
            <ScrollView 
              className="flex-1 px-4 pt-5" 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
            >
              {scrollContent}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>

      {/* Custom Alert Modal */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent={true} animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-4" style={{ maxHeight: '90%' }}>
            <View className="flex-row justify-between items-center mb-4 px-2">
              <Text className="text-xl font-bold text-gray-800">
                Select {activeDateField === 'preferred_date' ? 'Request Date' : 'Marriage Date'}
              </Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} className="p-2">
                <Feather name="x" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <DatePickerCalendar
              selectedMonth={selectedMonth}
              selectedDate={formData[activeDateField]}
              onMonthChange={changeMonth}
              onDateSelect={handleDateSelect}
              isDateDisabled={isDateDisabled}
            />
            <TouchableOpacity onPress={() => setShowDatePicker(false)} className="mt-4 bg-blue-600 py-3 rounded-xl mx-2">
              <Text className="text-white text-center font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Dropdown Modal */}
      <TimeDropdownModal
        visible={showTimeDropdown}
        selectedValue={formData.preferred_time}
        onSelect={(value) => handleChange('preferred_time', value)}
        onClose={() => setShowTimeDropdown(false)}
      />
    </View>
  );
}