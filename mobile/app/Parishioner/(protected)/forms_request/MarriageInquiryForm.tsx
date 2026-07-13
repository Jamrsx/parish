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
  Dimensions,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { api } from '../../../../library/api';

const { height } = Dimensions.get('window');

interface MarriageInquiryFormData {
  husband_name: string;
  wife_name: string;
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
  const isWeb = Platform.OS === 'web';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType={isWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View 
        className="flex-1 justify-center items-center bg-black/50"
        style={isWeb ? ({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } as any) : {}}
      >
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
  const isWeb = Platform.OS === 'web';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType={isWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View 
        className="flex-1 bg-black/50 justify-end"
        style={isWeb ? ({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } as any) : {}}
      >
        <View 
          className="bg-white rounded-t-3xl p-4 max-h-[60%]"
          style={isWeb ? ({ maxWidth: 500, alignSelf: 'center', width: '100%', borderRadius: 16 } as any) : {}}
        >
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

export default function MarriageInquiryForm() {
  const router = useRouter();
  const { user } = useAuth();
  const isWeb = Platform.OS === 'web';

  const [formData, setFormData] = useState<MarriageInquiryFormData>({
    husband_name: '',
    wife_name: '',
    address: '',
    contact_number: '',
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
  }>({
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: () => {}, style: 'default' }],
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  const goToChurchService = () => {
    router.replace('/Parishioner/(protected)/(tabs)/church_service');
  };

  const showCustomAlert = (title: string, message: string, buttons: CustomAlertButton[]) => {
    setAlertConfig({ title, message, buttons });
    setAlertVisible(true);
  };

  const getDisplayTime = (time24Hour: string): string => {
    if (!time24Hour) return 'Select time';
    const option = timeOptions.find(t => t.value === time24Hour);
    return option ? option.label : 'Select time';
  };

  // Calendar functions
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const isDateDisabled = (year: number, month: number, day: number) => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const checkDate = new Date(year, month, day);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < todayDate;
  };

  const handleDateSelect = (day: number) => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    if (!isDateDisabled(year, month, day)) {
      const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      handleChange('preferred_date', formattedDate);
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

  const renderCalendar = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const calendarDays: React.ReactNode[] = [];

    weekdays.forEach((day, index) => {
      calendarDays.push(
        <View key={`header-${index}`} className="w-10 h-10 justify-center items-center">
          <Text className="text-xs font-semibold text-gray-500">{day}</Text>
        </View>
      );
    });

    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(<View key={`empty-${i}`} className="w-10 h-10" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const disabled = isDateDisabled(year, month, day);
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = formData.preferred_date === dateString;

      calendarDays.push(
        <TouchableOpacity
          key={`day-${day}`}
          onPress={() => !disabled && handleDateSelect(day)}
          className={`w-10 h-10 justify-center items-center rounded-full ${
            disabled ? 'bg-gray-100' : isSelected ? 'bg-blue-500' : 'bg-white'
          }`}
          disabled={disabled}
        >
          <Text className={`text-sm ${disabled ? 'text-gray-400' : isSelected ? 'text-white font-bold' : 'text-gray-700'}`}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View className="mt-4">
        <View className="flex-row justify-between items-center mb-4 px-4">
          <TouchableOpacity onPress={() => changeMonth(-1)} className="p-2">
            <Text className="text-2xl text-gray-600">←</Text>
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800">
            {selectedMonth.toLocaleString('default', { month: 'long' })} {year}
          </Text>
          <TouchableOpacity onPress={() => changeMonth(1)} className="p-2">
            <Text className="text-2xl text-gray-600">→</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row flex-wrap justify-start gap-1 px-2">{calendarDays}</View>
      </View>
    );
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

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
      isValid = false;
    } else if (formData.address.trim().length < 5) {
      newErrors.address = 'Please enter a complete address';
      isValid = false;
    }
    if (!formData.preferred_date) {
      newErrors.preferred_date = 'Wedding date is required';
      isValid = false;
    }
    if (!formData.preferred_time) {
      newErrors.preferred_time = 'Time is required';
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

    setErrors(newErrors);
    return isValid;
  };

  const handleChange = (field: keyof MarriageInquiryFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // SUBMIT
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
      //Get Marriage service ID first
      const marriageService = await api.getServiceByName('Marriage');

      if (!marriageService) {
        throw new Error('Marriage service not found');
      }

      // Combine husband and wife names for the backend
      const couple_names = `${formData.husband_name} & ${formData.wife_name}`;

      //Create service form with service_id
      const serviceFormResponse = await api.createServiceForm({
        service_id: marriageService.service_id,
        full_name: couple_names,
        address: formData.address,
        contact_number: formData.contact_number,
        preferred_date: formData.preferred_date,
        preferred_time: formData.preferred_time,
      });

      if (!serviceFormResponse.success) {
        throw new Error(serviceFormResponse.message || 'Failed to create service form');
      }

      const serviceFormId = serviceFormResponse.data.serviceform_id;

      //Create the request
      const requestResponse = await api.createRequest({
        user_id: user.user_id,
        service_id: marriageService.service_id,
        service_form_id: serviceFormId,
      });

      if (!requestResponse.success) {
        throw new Error(requestResponse.message || 'Failed to create request');
      }

      setIsSubmitting(false);

      showCustomAlert(
        'Request Submitted!',
        `Your Marriage Inquiry has been submitted successfully!\n\nHusband: ${formData.husband_name}\nWife: ${formData.wife_name}\nDate: ${formData.preferred_date}\nTime: ${getDisplayTime(formData.preferred_time)}`,
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
      console.error('Marriage submission error:', error);
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
    <>
      {/* Header */}
      <View className="flex-row items-center gap-3 mb-6">
        <TouchableOpacity 
          onPress={goToChurchService} 
          className="w-9 h-9 items-center justify-center rounded-full border border-gray-200 bg-white"
        >
          <Text className="text-gray-500 text-lg">←</Text>
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-bold text-gray-800">💍 Marriage Inquiry</Text>
          <Text className="text-xs text-gray-400">Fill in all required fields</Text>
        </View>
      </View>

      {/* Couple Information */}
      <SectionCard title="Couple's Information">
        <View className="flex-row gap-3 mb-3">
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

      {/* Schedule */}
      <SectionCard title="Preferred Schedule">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">Preferred Date *</Text>
            <TouchableOpacity
              onPress={() => {
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
        </View>
      </SectionCard>

      {/* Actions */}
      <View className="flex-row gap-3 mt-2 mb-12">
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
            <Text className="text-white text-center text-sm font-semibold">Submit Request</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
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

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />

      <Modal visible={showDatePicker} transparent={true} animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-4 min-h-[400px]">
            <View className="flex-row justify-between items-center mb-4 px-4">
              <Text className="text-xl font-bold text-gray-800">Select Wedding Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text className="text-2xl text-gray-500">✕</Text>
              </TouchableOpacity>
            </View>
            {renderCalendar()}
            <TouchableOpacity onPress={() => setShowDatePicker(false)} className="mt-4 bg-blue-500 py-3 rounded-xl mx-4">
              <Text className="text-white text-center font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TimeDropdownModal
        visible={showTimeDropdown}
        selectedValue={formData.preferred_time}
        onSelect={(value) => handleChange('preferred_time', value)}
        onClose={() => setShowTimeDropdown(false)}
      />
    </View>
  );
}