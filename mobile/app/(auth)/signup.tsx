import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

interface FormErrors {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  contact_number?: string;
  address?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
}

const CustomAlert = ({
  visible,
  title,
  message,
  onClose,
}: {
  visible: boolean;
  title: string;
  message: string;
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
      <View className="absolute inset-0 bg-black/50 justify-center items-center z-50">
        <View className="bg-white rounded-2xl p-6 w-11/12 max-w-sm">
          <Text className="text-xl font-bold text-gray-800 text-center mb-2">
            {title}
          </Text>
          <Text className="text-gray-600 text-center text-base mb-6">
            {message}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="bg-blue-600 py-3 rounded-xl"
          >
            <Text className="text-white text-center font-semibold">OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const SignUpScreen = () => {
  const router = useRouter();
  const { register, isLoading } = useAuth();

  // Force re-render key for KeyboardAvoidingView
  const [keyboardKey, setKeyboardKey] = useState(0);

  // Reset keyboard when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      // Force KeyboardAvoidingView to re-render
      setKeyboardKey(prev => prev + 1);
      // Dismiss keyboard if open
      Keyboard.dismiss();
      return () => {};
    }, [])
  );

  // STATE
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    contact_number: '',
    address: '',
    email: '',
    password: '',
    password_confirmation: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Custom Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '' });

  // HELPERS
  const showCustomAlert = (title: string, message: string) => {
    setAlertConfig({ title, message });
    setAlertVisible(true);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouchedFields(prev => new Set(prev).add(field));
    const error = validateField(field, formData[field as keyof typeof formData]);
    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'first_name':
        if (!value.trim()) return 'First name is required';
        if (value.trim().length < 2) return 'First name must be at least 2 characters';
        if (!/^[a-zA-Z\s\-'.]+$/.test(value.trim())) {
          return 'Only letters, spaces, hyphens, apostrophes, and periods allowed';
        }
        return '';

      case 'last_name':
        if (!value.trim()) return 'Last name is required';
        if (value.trim().length < 2) return 'Last name must be at least 2 characters';
        if (!/^[a-zA-Z\s\-'.]+$/.test(value.trim())) {
          return 'Only letters, spaces, hyphens, apostrophes, and periods allowed';
        }
        return '';

      case 'middle_name':
        if (value.trim() && value.trim().length < 1) {
          return 'Middle name must be at least 2 characters if provided';
        }
        if (value.trim() && !/^[a-zA-Z\s\-'.]+$/.test(value.trim())) {
          return 'Only letters, spaces, hyphens, apostrophes, and periods allowed';
        }
        return '';

      case 'contact_number':
        if (!value.trim()) return 'Contact number is required';
        const phoneRegex = /^(09|\+639)\d{9}$/;
        const cleanNumber = value.trim().replace(/[\s\-()]/g, '');
        if (!phoneRegex.test(cleanNumber)) {
          return 'Enter valid PH number (e.g., 09123456789 or +639123456789)';
        }
        return '';

      case 'address':
        if (!value.trim()) return 'Address is required';
        if (value.trim().length < 4) return 'Please enter a complete address';
        return '';

      case 'email':
        if (!value.trim()) return 'Email address is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) {
          return 'Please enter a valid email address';
        }
        return '';

      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        return '';

      case 'password_confirmation':
        if (!value) return 'Please confirm your password';
        if (value !== formData.password) return 'Passwords do not match';
        return '';

      default:
        return '';
    }
  };

  const validateAllFields = (): boolean => {
    const fieldsToValidate = [
      'first_name',
      'last_name',
      'contact_number',
      'address',
      'email',
      'password',
      'password_confirmation',
    ];

    const newErrors: FormErrors = {};
    let isValid = true;

    const allTouched = new Set(fieldsToValidate);
    setTouchedFields(allTouched);

    for (const field of fieldsToValidate) {
      const value = formData[field as keyof typeof formData];
      const error = validateField(field, value);
      if (error) {
        newErrors[field as keyof FormErrors] = error;
        isValid = false;
      }
    }

    if (formData.middle_name.trim()) {
      const middleError = validateField('middle_name', formData.middle_name);
      if (middleError) {
        newErrors.middle_name = middleError;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  // HANDLE SIGN UP
  const handleSignUp = async () => {
    if (!validateAllFields()) {
      showCustomAlert('Validation Error', 'Please correct the errors in the form');
      return;
    }

    try {
      await register({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        middle_name: formData.middle_name.trim() || undefined,
        contact_number: formData.contact_number.trim().replace(/[\s\-()]/g, ''),
        address: formData.address.trim(),
        email: formData.email.trim(),
        password: formData.password,
        password_confirmation: formData.password_confirmation,
      });

      showCustomAlert('Success', 'Registration successful! Welcome to the parish community.');
      console.log('Signup success — replacing stack to home (no back to login)');
      router.replace('/Parishioner/(protected)/(tabs)/home');
    } catch (error: any) {
      const errorMessage = error?.message || 'Registration failed. Please try again.';
      showCustomAlert('Registration Failed', errorMessage);
    }
  };

  // RENDER HELPERS
  const ErrorMessage = ({ message }: { message?: string }) => {
    if (!message) return null;
    return <Text className="text-red-500 text-xs mt-1 ml-1">{message}</Text>;
  };

  // RENDER
  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView
        key={keyboardKey}
        behavior="height"
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 pt-10">
            <TouchableOpacity 
              onPress={() => router.push('/(auth)/login')}
              className="flex-row items-center mb-5"
            >
              <Feather name="arrow-left" size={22} color="#2563EB" />
              <Text className="text-blue-600 text-base font-medium ml-3">Back to Login</Text>
            </TouchableOpacity>

            {/* Header */}
            <View className="mb-8">
              <Text className="text-4xl font-bold text-blue-600 mb-2">Create Account</Text>
              <Text className="text-gray-600 text-base">Register as a parishioner</Text>
            </View>

            {/* Form Fields */}
            <View className="space-y-4">
              {/* First Name & Last Name */}
              <View className="flex-row space-x-4 gap-2">
                <View className="flex-1">
                  <Text className="text-gray-700 font-medium mb-1 ml-1">
                    First Name <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className={`bg-white border rounded-xl px-4 py-3 text-gray-700 ${
                      errors.first_name && touchedFields.has('first_name')
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                    placeholder="Enter first name"
                    value={formData.first_name}
                    onChangeText={(text) => handleInputChange('first_name', text)}
                    onBlur={() => handleFieldBlur('first_name')}
                  />
                  {touchedFields.has('first_name') && <ErrorMessage message={errors.first_name} />}
                </View>

                <View className="flex-1">
                  <Text className="text-gray-700 font-medium mb-1 ml-1">
                    Last Name <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className={`bg-white border rounded-xl px-4 py-3 text-gray-700 ${
                      errors.last_name && touchedFields.has('last_name')
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                    placeholder="Enter last name"
                    value={formData.last_name}
                    onChangeText={(text) => handleInputChange('last_name', text)}
                    onBlur={() => handleFieldBlur('last_name')}
                  />
                  {touchedFields.has('last_name') && <ErrorMessage message={errors.last_name} />}
                </View>
              </View>

              {/* Middle Name */}
              <View>
                <Text className="text-gray-700 font-medium mb-1 ml-1">
                  Middle Name <Text className="text-gray-400">(Optional)</Text>
                </Text>
                <TextInput
                  className={`bg-white border rounded-xl px-4 py-3 text-gray-700 ${
                    errors.middle_name && touchedFields.has('middle_name')
                      ? 'border-red-500'
                      : 'border-gray-300'
                  }`}
                  placeholder="Enter middle name"
                  value={formData.middle_name}
                  onChangeText={(text) => handleInputChange('middle_name', text)}
                  onBlur={() => handleFieldBlur('middle_name')}
                />
                {touchedFields.has('middle_name') && <ErrorMessage message={errors.middle_name} />}
              </View>

              {/* Contact Number */}
              <View>
                <Text className="text-gray-700 font-medium mb-1 ml-1">
                  Contact Number <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className={`bg-white border rounded-xl px-4 py-3 text-gray-700 ${
                    errors.contact_number && touchedFields.has('contact_number')
                      ? 'border-red-500'
                      : 'border-gray-300'
                  }`}
                  placeholder="09123456789"
                  keyboardType="phone-pad"
                  value={formData.contact_number}
                  onChangeText={(text) => handleInputChange('contact_number', text)}
                  onBlur={() => handleFieldBlur('contact_number')}
                />
                {touchedFields.has('contact_number') && <ErrorMessage message={errors.contact_number} />}
              </View>

              {/* Address */}
              <View>
                <Text className="text-gray-700 font-medium mb-1 ml-1">
                  Address <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className={`bg-white border rounded-xl px-4 py-3 text-gray-700 ${
                    errors.address && touchedFields.has('address')
                      ? 'border-red-500'
                      : 'border-gray-300'
                  }`}
                  placeholder="Enter your complete address"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={formData.address}
                  onChangeText={(text) => handleInputChange('address', text)}
                  onBlur={() => handleFieldBlur('address')}
                />
                {touchedFields.has('address') && <ErrorMessage message={errors.address} />}
              </View>

              {/* Email */}
              <View>
                <Text className="text-gray-700 font-medium mb-1 ml-1">
                  Email Address <Text className="text-red-500">*</Text>
                </Text>
                <View
                  className={`flex-row items-center bg-white border rounded-xl px-4 ${
                    errors.email && touchedFields.has('email')
                      ? 'border-red-500'
                      : 'border-gray-300'
                  }`}
                >
                  <Feather name="mail" size={20} color="#6B7280" />
                  <TextInput
                    className="flex-1 py-3 ml-2 text-gray-700"
                    placeholder="example@gmail.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formData.email}
                    onChangeText={(text) => handleInputChange('email', text)}
                    onBlur={() => handleFieldBlur('email')}
                  />
                </View>
                {touchedFields.has('email') && <ErrorMessage message={errors.email} />}
              </View>

              {/* Password */}
              <View>
                <Text className="text-gray-700 font-medium mb-1 ml-1">
                  Password <Text className="text-red-500">*</Text>
                </Text>
                <View
                  className={`flex-row items-center bg-white border rounded-xl px-4 ${
                    errors.password && touchedFields.has('password')
                      ? 'border-red-500'
                      : 'border-gray-300'
                  }`}
                >
                  <Feather name="lock" size={20} color="#6B7280" />
                  <TextInput
                    className="flex-1 py-3 ml-2 text-gray-700"
                    placeholder="Create a password"
                    secureTextEntry={!showPassword}
                    value={formData.password}
                    onChangeText={(text) => handleInputChange('password', text)}
                    onBlur={() => handleFieldBlur('password')}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                {touchedFields.has('password') && <ErrorMessage message={errors.password} />}
                <Text className="text-xs text-gray-500 mt-1 ml-1">Minimum 8 characters</Text>
              </View>

              {/* Confirm Password */}
              <View>
                <Text className="text-gray-700 font-medium mb-1 ml-1">
                  Confirm Password <Text className="text-red-500">*</Text>
                </Text>
                <View
                  className={`flex-row items-center bg-white border rounded-xl px-4 ${
                    errors.password_confirmation && touchedFields.has('password_confirmation')
                      ? 'border-red-500'
                      : 'border-gray-300'
                  }`}
                >
                  <Feather name="lock" size={20} color="#6B7280" />
                  <TextInput
                    className="flex-1 py-3 ml-2 text-gray-700"
                    placeholder="Confirm your password"
                    secureTextEntry={!showConfirmPassword}
                    value={formData.password_confirmation}
                    onChangeText={(text) => handleInputChange('password_confirmation', text)}
                    onBlur={() => handleFieldBlur('password_confirmation')}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Feather name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                {touchedFields.has('password_confirmation') && <ErrorMessage message={errors.password_confirmation} />}
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity
                className={`bg-blue-600 rounded-xl py-4 mt-6 ${isLoading ? 'opacity-70' : ''}`}
                onPress={handleSignUp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-center font-semibold text-lg">Create Account</Text>
                )}
              </TouchableOpacity>

              {/* Login Link */}
              <View className="flex-row justify-center mt-6">
                <Text className="text-gray-600">Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                  <Text className="text-blue-600 font-semibold">Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Custom Alert Modal */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
};

export default SignUpScreen;