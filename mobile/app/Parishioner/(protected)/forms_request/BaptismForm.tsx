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
import { useFormDraft } from '../../../../hooks/useFormDraft';

// TYPE
interface BaptismFormData {
  child_first_name: string;
  child_middle_name: string;
  child_last_name: string;
  child_birth_date: string;
  child_birth_place: string;
  mother_first_name: string;
  mother_middle_name: string;
  mother_last_name: string;
  father_first_name: string;
  father_middle_name: string;
  father_last_name: string;
  address: string;
  contact_number: string;
  preferred_date: string;
  preferred_time: string;
  ninongs: string[];
  ninangs: string[];
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

// HELPER COMPONENT
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

// Updated GodparentNameList to show full name
const GodparentNameList = ({
  names,
  type,
  onRemove,
}: {
  names: string[];
  type: 'ninong' | 'ninang';
  onRemove: (type: 'ninong' | 'ninang', index: number) => void;
}) => {
  return (
    <View>
      {names.length === 0 ? (
        <Text className="text-sm text-gray-400 italic">None added yet</Text>
      ) : (
        <View className="gap-1.5">
          {names.map((name, i) => (
            <View key={i} className="flex-row items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <Text className="text-sm text-gray-700 flex-1">{name}</Text>
              <TouchableOpacity onPress={() => onRemove(type, i)} className="ml-2">
                <Text className="text-gray-400 text-base">✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// UPDATED: GodparentSheet with separate name fields
const GodparentSheet = ({
  visible,
  selectedType,
  setSelectedType,
  firstName,
  setFirstName,
  middleName,
  setMiddleName,
  lastName,
  setLastName,
  onAdd,
  onClose,
}: {
  visible: boolean;
  selectedType: 'ninong' | 'ninang';
  setSelectedType: (t: 'ninong' | 'ninang') => void;
  firstName: string;
  setFirstName: (v: string) => void;
  middleName: string;
  setMiddleName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  onAdd: () => void;
  onClose: () => void;
}) => {
  const [error, setError] = useState('');
  const isWeb = Platform.OS === 'web';

  const handleAdd = () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    
    if (!trimmedFirst || !trimmedLast) {
      setError('First name and last name are required');
      return;
    }
    
    if (trimmedFirst.length < 2 || trimmedLast.length < 2) {
      setError('Names must be at least 2 characters');
      return;
    }
    
    setError('');
    onAdd();
  };

  return (
    <Modal 
      animationType="slide" 
      transparent={true} 
      visible={visible} 
      onRequestClose={onClose}
    >
      <View 
        className="flex-1 justify-end bg-black/40" 
        onTouchEnd={onClose}
        style={isWeb ? ({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } as any) : {}}
      >
        <View 
          className="bg-white rounded-t-2xl p-5 pb-8"
          style={isWeb ? ({ maxWidth: 500, alignSelf: 'center', width: '100%', borderRadius: 16 } as any) : {}}
          onTouchEnd={e => e.stopPropagation()}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-base font-semibold text-gray-800">Add Godparent</Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-gray-400 text-xl">✕</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-2 mb-4">
            <TouchableOpacity
              onPress={() => setSelectedType('ninong')}
              className={`flex-1 py-2 rounded-lg ${selectedType === 'ninong' ? 'bg-blue-600' : 'bg-gray-100'}`}
            >
              <Text className={`text-sm font-medium text-center ${selectedType === 'ninong' ? 'text-white' : 'text-gray-600'}`}>
                Godfather
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedType('ninang')}
              className={`flex-1 py-2 rounded-lg ${selectedType === 'ninang' ? 'bg-pink-600' : 'bg-gray-100'}`}
            >
              <Text className={`text-sm font-medium text-center ${selectedType === 'ninang' ? 'text-white' : 'text-gray-600'}`}>
                Godmother
              </Text>
            </TouchableOpacity>
          </View>

          <View>
            <Text className="text-sm text-gray-600 font-medium mb-1">First Name *</Text>
            <TextInput
              className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white mb-2 ${
                error && !firstName.trim() ? 'border-red-500' : 'border-gray-200'
              }`}
              placeholder={`Enter ${selectedType === 'ninong' ? 'godfather' : 'godmother'} first name`}
              value={firstName}
              onChangeText={text => {
                setFirstName(text);
                if (error) setError('');
              }}
              onSubmitEditing={handleAdd}
              autoFocus={!isWeb}
            />

            <Text className="text-sm text-gray-600 font-medium mb-1">Middle Name</Text>
            <TextInput
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white mb-2"
              placeholder={`Enter ${selectedType === 'ninong' ? 'godfather' : 'godmother'} middle name`}
              value={middleName}
              onChangeText={setMiddleName}
            />

            <Text className="text-sm text-gray-600 font-medium mb-1">Last Name *</Text>
            <TextInput
              className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white mb-1 ${
                error && !lastName.trim() ? 'border-red-500' : 'border-gray-200'
              }`}
              placeholder={`Enter ${selectedType === 'ninong' ? 'godfather' : 'godmother'} last name`}
              value={lastName}
              onChangeText={text => {
                setLastName(text);
                if (error) setError('');
              }}
              onSubmitEditing={handleAdd}
            />
            <ErrorMessage message={error} />
          </View>

          <TouchableOpacity onPress={handleAdd} className="w-full bg-blue-600 py-2.5 rounded-xl mt-3">
            <Text className="text-white text-center text-sm font-semibold">Add Godparent</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// TIME OPTION
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

// TIME DROPDOWN MODAL
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

// MAIN COMPONENT
export default function BaptismForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { isWeb, height } = useResponsive();

  // STATE
  const [formData, setFormData] = useState<BaptismFormData>({
    child_first_name: '',
    child_middle_name: '',
    child_last_name: '',
    child_birth_date: '',
    child_birth_place: '',
    mother_first_name: '',
    mother_middle_name: '',
    mother_last_name: '',
    father_first_name: '',
    father_middle_name: '',
    father_last_name: '',
    address: '',
    contact_number: '',
    preferred_date: '',
    preferred_time: '',
    ninongs: [],
    ninangs: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gpSheetVisible, setGpSheetVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<'ninong' | 'ninang'>('ninong');
  
  // UPDATED: Individual state for godparent name fields
  const [gpFirstName, setGpFirstName] = useState('');
  const [gpMiddleName, setGpMiddleName] = useState('');
  const [gpLastName, setGpLastName] = useState('');

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

  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [activeDateField, setActiveDateField] = useState<'preferred_date' | 'child_birth_date'>('preferred_date');

  // Time dropdown state
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  const { draftRestored, clearDraft } = useFormDraft<BaptismFormData>({
    formKey: 'baptism',
    userId: user?.user_id,
    formData,
    setFormData,
  });

  // HELPERS
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

  // CALENDAR FUNCTIONS
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

  const handleYearChange = (year: number) => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setFullYear(year);
      return newDate;
    });
  };

  const openBirthDatePicker = () => {
    setActiveDateField('child_birth_date');
    if (formData.child_birth_date) {
      setSelectedMonth(new Date(formData.child_birth_date));
    } else {
      const defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() - 5);
      setSelectedMonth(defaultDate);
    }
    setShowDatePicker(true);
  };

  // VALIDATION
  const validateAllFields = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    const requiredFields: Record<string, string> = {
      child_first_name: 'Child first name is required',
      child_last_name: 'Child last name is required',
      child_birth_date: 'Birth date is required',
      mother_first_name: "Mother's first name is required",
      mother_last_name: "Mother's last name is required",
      father_first_name: "Father's first name is required",
      father_last_name: "Father's last name is required",
      address: 'Address is required',
      contact_number: 'Contact number is required',
      preferred_date: 'Preferred date is required',
      preferred_time: 'Preferred time is required',
    };

    for (const [field, message] of Object.entries(requiredFields)) {
      const value = formData[field as keyof BaptismFormData];
      if (!value || (typeof value === 'string' && !value.trim())) {
        newErrors[field] = message;
        isValid = false;
      }
    }

    // Validate contact number: exactly 11 digits, starts with 09
    if (formData.contact_number) {
      const phoneRegex = /^09\d{9}$/;
      if (!phoneRegex.test(formData.contact_number)) {
        newErrors.contact_number = 'Enter 11-digit PH number (e.g., 09123456789)';
        isValid = false;
      }
    }

    // Validate birth date
    if (formData.child_birth_date) {
      const birthDate = new Date(formData.child_birth_date);
      birthDate.setHours(0, 0, 0, 0);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      if (birthDate.getTime() === todayDate.getTime()) {
        newErrors.child_birth_date = 'Child cannot be baptized on the same day they were born';
        isValid = false;
      } else if (birthDate > todayDate) {
        newErrors.child_birth_date = 'Birth date cannot be in the future';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleChange = (field: keyof BaptismFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleContactNumberChange = (text: string) => {
    const digitsOnly = text.replace(/\D/g, '').slice(0, 11);
    console.log('BaptismForm contact number input:', digitsOnly);
    handleChange('contact_number', digitsOnly);
  };

  //Godparent handlers with full name construction
  const handleAddName = () => {
    const trimmedFirst = gpFirstName.trim();
    const trimmedMiddle = gpMiddleName.trim();
    const trimmedLast = gpLastName.trim();
    
    if (!trimmedFirst || !trimmedLast) return;
    
    // Construct full name
    const fullName = trimmedMiddle 
      ? `${trimmedFirst} ${trimmedMiddle} ${trimmedLast}`
      : `${trimmedFirst} ${trimmedLast}`;
    
    if (selectedType === 'ninong') {
      setFormData(prev => ({ ...prev, ninongs: [...prev.ninongs, fullName] }));
    } else {
      setFormData(prev => ({ ...prev, ninangs: [...prev.ninangs, fullName] }));
    }
    
    // Reset fields
    setGpFirstName('');
    setGpMiddleName('');
    setGpLastName('');
    setGpSheetVisible(false);
  };

  const handleRemoveName = (type: 'ninong' | 'ninang', index: number) => {
    if (type === 'ninong') {
      setFormData(prev => ({
        ...prev,
        ninongs: prev.ninongs.filter((_, i) => i !== index),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        ninangs: prev.ninangs.filter((_, i) => i !== index),
      }));
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
      const baptismResponse = await api.createBaptismForm({
        child_first_name: formData.child_first_name,
        child_last_name: formData.child_last_name,
        child_middle_name: formData.child_middle_name || undefined,
        child_birth_date: formData.child_birth_date,
        child_birth_place: formData.child_birth_place || '',
        mother_first_name: formData.mother_first_name,
        mother_last_name: formData.mother_last_name,
        mother_middle_name: formData.mother_middle_name || undefined,
        father_first_name: formData.father_first_name,
        father_last_name: formData.father_last_name,
        father_middle_name: formData.father_middle_name || undefined,
        address: formData.address,
        contact_number: formData.contact_number,
        preferred_date: formData.preferred_date,
        preferred_time: formData.preferred_time,
      });

      if (!baptismResponse.success) {
        throw new Error(baptismResponse.message || 'Failed to create baptism form');
      }

      const baptismId = baptismResponse.data.baptism_id;

      const allGodparents = [
        ...formData.ninongs.map(name => ({ godparent_name: name, relationship: 'godfather' as const })),
        ...formData.ninangs.map(name => ({ godparent_name: name, relationship: 'godmother' as const })),
      ];

      if (allGodparents.length > 0) {
        await api.bulkAddGodparents(baptismId, { godparents: allGodparents });
      }

      //Get Baptism service ID
      const baptismService = await api.getServiceByName('Baptism');

      if (!baptismService) {
        throw new Error('Baptism service not found');
      }

      //Create the request
      const requestResponse = await api.createRequest({
        user_id: user.user_id,
        service_id: baptismService.service_id,
        baptism_form_id: baptismId,
      });

      if (!requestResponse.success) {
        throw new Error(requestResponse.message || 'Failed to create request');
      }

      setIsSubmitting(false);

      await clearDraft();

      showCustomAlert(
        'Request Submitted!',
        `Your Baptism request has been submitted successfully!\n\nChild: ${formData.child_first_name} ${formData.child_last_name}\nPreferred Date: ${formData.preferred_date}\nTime: ${getDisplayTime(formData.preferred_time)}`,
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
      console.error('Baptism submission error:', error);
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

  // RENDER
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
          <Text className="text-xl font-bold text-gray-800">Baptism Form</Text>
          <Text className="text-xs text-gray-400">Fill in all required fields</Text>
          {draftRestored && (
            <Text className="text-xs text-blue-600 mt-1">Draft restored — your previous entries were saved</Text>
          )}
        </View>
      </View>

      {/* Child Information */}
      <SectionCard title="Child Information">
        <ResponsiveRow className="mb-3">
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">First Name *</Text>
            <TextInput
              className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
                errors.child_first_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter child's first name"
              placeholderTextColor="#9CA3AF"
              value={formData.child_first_name}
              onChangeText={text => handleChange('child_first_name', text)}
            />
            <ErrorMessage message={errors.child_first_name} />
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">Last Name *</Text>
            <TextInput
              className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
                errors.child_last_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter child's last name"
              placeholderTextColor="#9CA3AF"
              value={formData.child_last_name}
              onChangeText={text => handleChange('child_last_name', text)}
            />
            <ErrorMessage message={errors.child_last_name} />
          </View>
        </ResponsiveRow>

        <View className="mb-3">
          <Text className="text-sm text-gray-600 font-medium mb-1">Middle Name</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-gray-800 bg-gray-50"
            placeholder="Enter child's middle name"
            placeholderTextColor="#9CA3AF"
            value={formData.child_middle_name}
            onChangeText={text => handleChange('child_middle_name', text)}
          />
        </View>

        <ResponsiveRow>
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">Birth Date *</Text>
            <TouchableOpacity
              onPress={openBirthDatePicker}
              className={`border rounded-xl px-4 py-3 bg-gray-50 ${
                errors.child_birth_date ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <Text className={formData.child_birth_date ? 'text-gray-800' : 'text-gray-400'}>
                {formData.child_birth_date || 'Select birth date'}
              </Text>
            </TouchableOpacity>
            <ErrorMessage message={errors.child_birth_date} />
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">Birth Place</Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-gray-800 bg-gray-50"
              placeholder="Enter birth place"
              placeholderTextColor="#9CA3AF"
              value={formData.child_birth_place}
              onChangeText={text => handleChange('child_birth_place', text)}
            />
          </View>
        </ResponsiveRow>
      </SectionCard>

      {/* Parents Information */}
      <SectionCard title="Parents Information">
        <Text className="text-sm font-semibold text-gray-600 mb-3">Mother</Text>
        <ResponsiveRow className="mb-3">
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">First Name *</Text>
            <TextInput
              className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
                errors.mother_first_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter mother's first name"
              placeholderTextColor="#9CA3AF"
              value={formData.mother_first_name}
              onChangeText={text => handleChange('mother_first_name', text)}
            />
            <ErrorMessage message={errors.mother_first_name} />
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">Last Name *</Text>
            <TextInput
              className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
                errors.mother_last_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter mother's last name"
              placeholderTextColor="#9CA3AF"
              value={formData.mother_last_name}
              onChangeText={text => handleChange('mother_last_name', text)}
            />
            <ErrorMessage message={errors.mother_last_name} />
          </View>
        </ResponsiveRow>
        <View className="mb-3">
          <Text className="text-sm text-gray-600 font-medium mb-1">Middle Name</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-gray-800 bg-gray-50"
            placeholder="Enter mother's middle name"
            placeholderTextColor="#9CA3AF"
            value={formData.mother_middle_name}
            onChangeText={text => handleChange('mother_middle_name', text)}
          />
        </View>

        <Text className="text-sm font-semibold text-gray-600 mb-3 mt-4">Father</Text>
        <ResponsiveRow className="mb-3">
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">First Name *</Text>
            <TextInput
              className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
                errors.father_first_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter father's first name"
              placeholderTextColor="#9CA3AF"
              value={formData.father_first_name}
              onChangeText={text => handleChange('father_first_name', text)}
            />
            <ErrorMessage message={errors.father_first_name} />
          </View>
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">Last Name *</Text>
            <TextInput
              className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
                errors.father_last_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter father's last name"
              placeholderTextColor="#9CA3AF"
              value={formData.father_last_name}
              onChangeText={text => handleChange('father_last_name', text)}
            />
            <ErrorMessage message={errors.father_last_name} />
          </View>
        </ResponsiveRow>
        <View>
          <Text className="text-sm text-gray-600 font-medium mb-1">Middle Name</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-gray-800 bg-gray-50"
            placeholder="Enter father's middle name"
            placeholderTextColor="#9CA3AF"
            value={formData.father_middle_name}
            onChangeText={text => handleChange('father_middle_name', text)}
          />
        </View>
      </SectionCard>

      {/* Preferred Schedule */}
      <SectionCard title="Preferred Schedule">
        <ResponsiveRow>
          <View className="flex-1">
            <Text className="text-sm text-gray-600 font-medium mb-1">Preferred Date *</Text>
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
                {formData.preferred_date || 'Select preferred date'}
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

      {/* Contact Information */}
      <SectionCard title="Contact Information">
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
            placeholder="09123456789"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            maxLength={11}
            value={formData.contact_number}
            onChangeText={handleContactNumberChange}
          />
          <Text className="text-xs text-gray-400 mt-1">
            {formData.contact_number.length}/11 digits
          </Text>
          <ErrorMessage message={errors.contact_number} />
        </View>
      </SectionCard>

      {/* Godparents */}
      <SectionCard>
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Godparents</Text>
          <TouchableOpacity onPress={() => setGpSheetVisible(true)}>
            <Text className="text-xs font-semibold text-blue-600">+ Add</Text>
          </TouchableOpacity>
        </View>

        <ResponsiveRow gap={16}>
          <View className="flex-1">
            <Text className="text-xs font-medium text-blue-600 mb-2">Godfathers ({formData.ninongs.length})</Text>
            <GodparentNameList
              names={formData.ninongs}
              type="ninong"
              onRemove={handleRemoveName}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-medium text-pink-600 mb-2">Godmothers ({formData.ninangs.length})</Text>
            <GodparentNameList
              names={formData.ninangs}
              type="ninang"
              onRemove={handleRemoveName}
            />
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
            <Text className="text-white text-center text-sm font-semibold">Submit Request</Text>
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
            className="pt-5" 
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
              className="flex-1 pt-5" 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
            >
              {scrollContent}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />

      {/* Godparent Sheet */}
      <GodparentSheet
        visible={gpSheetVisible}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        firstName={gpFirstName}
        setFirstName={setGpFirstName}
        middleName={gpMiddleName}
        setMiddleName={setGpMiddleName}
        lastName={gpLastName}
        setLastName={setGpLastName}
        onAdd={handleAddName}
        onClose={() => {
          setGpSheetVisible(false);
          setGpFirstName('');
          setGpMiddleName('');
          setGpLastName('');
        }}
      />

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent={true} animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <View
          className="flex-1 bg-black/50 justify-end"
          style={isWeb ? ({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } as object) : undefined}
        >
          <View
            className="bg-white rounded-t-3xl"
            style={{
              maxHeight: '90%',
              ...(isWeb
                ? {
                    maxWidth: 440,
                    width: '100%',
                    alignSelf: 'center',
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                  }
                : {}),
            }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
              bounces={false}
            >
              <View className="flex-row justify-between items-center mb-2 px-1">
                <Text className="text-xl font-bold text-gray-800">
                  Select {activeDateField === 'preferred_date' ? 'Preferred Date' : 'Birth Date'}
                </Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)} className="p-2">
                  <Feather name="x" size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <DatePickerCalendar
                selectedMonth={selectedMonth}
                selectedDate={formData[activeDateField]}
                onMonthChange={changeMonth}
                onYearChange={handleYearChange}
                onDateSelect={handleDateSelect}
                isDateDisabled={isDateDisabled}
                enableYearPicker={activeDateField === 'child_birth_date'}
                minYear={new Date().getFullYear() - 100}
                maxYear={new Date().getFullYear()}
              />
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                className="mt-4 bg-blue-600 py-3 rounded-xl"
              >
                <Text className="text-white text-center font-semibold">Close</Text>
              </TouchableOpacity>
            </ScrollView>
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