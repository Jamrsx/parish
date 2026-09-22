import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

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
      <View className="flex-1 bg-black/20 backdrop-blur-sm items-center justify-center z-50">
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

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  // STATE
  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ login?: string; password?: string }>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '' });

  // HELPERS
  const showCustomAlert = (title: string, message: string) => {
    setAlertConfig({ title, message });
    setAlertVisible(true);
  };

  const clearLoginError = () => {
    if (loginError) setLoginError(null);
  };

  const validateField = (field: string, value: string): string => {
    if (field === 'login') {
      if (!value.trim()) return 'Email or username is required';
      return '';
    }
    if (field === 'password') {
      if (!value) return 'Password is required';
      if (value.length < 6) return 'Password must be at least 6 characters';
      return '';
    }
    return '';
  };

  const validateAllFields = (): boolean => {
    const newErrors: { login?: string; password?: string } = {};
    let isValid = true;

    const fieldLoginError = validateField('login', loginField);
    if (fieldLoginError) {
      newErrors.login = fieldLoginError;
      isValid = false;
    }

    const passwordError = validateField('password', password);
    if (passwordError) {
      newErrors.password = passwordError;
      isValid = false;
    }

    setErrors(newErrors);
    setTouchedFields(new Set(['login', 'password']));
    return isValid;
  };

  // HANDLE LOGIN
  const handleLogin = async () => {
    if (!validateAllFields()) return;

    setIsSubmitting(true);
    setLoginError(null);

    try {
      await login(loginField.trim(), password);
      console.log('Login success — replacing stack to home (no back to login)');
      router.replace('/Parishioner/(protected)/(tabs)/home');
    } catch (error: any) {
      const message =
        error?.message ||
        'Invalid email/username or password. Please check your credentials and try again.';
      console.log('[Login] failed:', message);
      setLoginError(message);
      showCustomAlert('Login Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // NAVIGATION
  const handleSignUp = () => {
    router.push('/(auth)/signup');
  };

  // RENDER
  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'left', 'right']}>
      {/* Status Bar */}
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        behavior="height"
        className="flex-1"
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          
          <View className="flex-1 justify-center items-center px-4 py-10">
            <View className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">

              {/* Header */}
              <View className="items-center mb-6">
                <View className="w-20 h-20 rounded-full bg-blue-100 items-center justify-center mb-3">
                  <Text className="text-4xl">⛪</Text>
                </View>
                <Text className="text-2xl font-bold text-gray-800">San Guillermo Parish</Text>
                <Text className="text-gray-500 text-center mt-1">
                  Sign in to your account
                </Text>
              </View>

              {loginError ? (
                <View className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <Text className="text-red-700 text-sm text-center font-medium">
                    {loginError}
                  </Text>
                </View>
              ) : null}

              {/* LOGIN FIELD */}
              <View className="mb-4">
                <Text className="text-gray-700 mb-2 font-medium">
                  Email or Username <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className={`w-full px-4 py-3 border rounded-lg bg-gray-50 text-gray-800 ${
                    errors.login && touchedFields.has('login')
                      ? 'border-red-500'
                      : 'border-gray-300'
                  }`}
                  placeholder="Enter your email or username"
                  placeholderTextColor="#9CA3AF"
                  value={loginField}
                  onChangeText={(text) => {
                    setLoginField(text);
                    clearLoginError();
                    if (errors.login) setErrors(prev => ({ ...prev, login: undefined }));
                  }}
                  onBlur={() => {
                    setTouchedFields(prev => new Set(prev).add('login'));
                    const error = validateField('login', loginField);
                    if (error) setErrors(prev => ({ ...prev, login: error }));
                  }}
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
                {touchedFields.has('login') && errors.login && (
                  <Text className="text-red-500 text-xs mt-1 ml-1">{errors.login}</Text>
                )}
              </View>

              {/* PASSWORD FIELD */}
              <View className="mb-6">
                <Text className="text-gray-700 mb-2 font-medium">
                  Password <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className={`w-full px-4 py-3 border rounded-lg bg-gray-50 text-gray-800 ${
                    errors.password && touchedFields.has('password')
                      ? 'border-red-500'
                      : 'border-gray-300'
                  }`}
                  placeholder="Enter your password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    clearLoginError();
                    if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                  }}
                  onBlur={() => {
                    setTouchedFields(prev => new Set(prev).add('password'));
                    const error = validateField('password', password);
                    if (error) setErrors(prev => ({ ...prev, password: error }));
                  }}
                  secureTextEntry
                  editable={!isSubmitting}
                />
                {touchedFields.has('password') && errors.password && (
                  <Text className="text-red-500 text-xs mt-1 ml-1">{errors.password}</Text>
                )}
              </View>

              {/* LOGIN BUTTON */}
              <TouchableOpacity
                className={`w-full bg-blue-600 py-3.5 rounded-lg mb-3 ${isSubmitting ? 'opacity-70' : ''}`}
                onPress={handleLogin}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-center font-semibold text-lg">Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Sign Up Link */}
              <View className="flex-row justify-center mt-2">
                <Text className="text-gray-600">Don&apos;t have an account? </Text>
                <TouchableOpacity onPress={handleSignUp} disabled={isSubmitting}>
                  <Text className="text-blue-600 font-semibold">Create Account</Text>
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
}
