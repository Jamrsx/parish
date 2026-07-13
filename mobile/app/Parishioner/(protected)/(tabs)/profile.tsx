import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { api } from '../../../../library/api';
import type { User } from '../../../../library/api';
import ResponsiveContainer from '../../../../components/ResponsiveContainer';
import ResponsiveRow from '../../../../components/ResponsiveRow';
import ParishionerHeader from '../../../../components/ParishionerHeader';
import { useResponsive } from '../../../../hooks/useResponsive';
import { Feather } from '@expo/vector-icons';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUser, refreshProfile } = useAuth();
  const { isCompact } = useResponsive();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const handleEditProfile = () => {
    setEditForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      middle_name: user?.middle_name || '',
      contact_number: user?.contact_number || '',
      address: user?.address || '',
    });
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    const errors: Record<string, string> = {};
    if (!editForm.first_name?.trim()) errors.first_name = 'First name is required';
    if (!editForm.last_name?.trim()) errors.last_name = 'Last name is required';
    if (editForm.contact_number && !/^(09|\+639)\d{9}$/.test(editForm.contact_number)) {
      errors.contact_number = 'Enter valid PH number';
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const response = await api.updateProfile(editForm);
      if (response.success) {
        await updateUser(response.data);
        await refreshProfile();
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center" edges={['top', 'left', 'right']}>
        <StatusBar backgroundColor="#ffffff" barStyle="dark-content" />
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'left', 'right']}>
      <StatusBar backgroundColor="#ffffff" barStyle="dark-content" />

      {/* Header */}
      <ParishionerHeader title="My Profile" subtitle="Manage your account" />

      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer className="pt-6">
        {/* Profile Card */}
        <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <View className="items-center">
            <View className="w-24 h-24 rounded-full bg-blue-100 items-center justify-center mb-4">
              <Text className="text-4xl font-bold text-blue-600">
                {user.first_name?.[0]?.toUpperCase()}
                {user.last_name?.[0]?.toUpperCase()}
              </Text>
            </View>
            <Text className="text-xl font-bold text-gray-800">
              {user.first_name} {user.last_name}
            </Text>
            <Text className="text-gray-500">{user.email}</Text>
            <TouchableOpacity 
              onPress={handleEditProfile} 
              className="mt-3 bg-blue-600 px-4 py-2 rounded-lg"
            >
              <Text className="text-white text-sm font-semibold">Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Details Section */}
        <View className="mt-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <Text className="text-lg font-semibold text-gray-800 mb-4">Personal Information</Text>
          
          <View className="space-y-4">
            {/* Full Name */}
            <View className="border-b border-gray-100 pb-3">
              <Text className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                Full Name
              </Text>
              <Text className="text-base text-gray-800 mt-1 font-medium">
                {user.first_name} {user.middle_name ? `${user.middle_name} ` : ''}{user.last_name}
              </Text>
            </View>

            {/* Email */}
            <View className="border-b border-gray-100 pb-3">
              <Text className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                Email Address
              </Text>
              <Text className="text-base text-gray-800 mt-1">
                {user.email}
              </Text>
            </View>

            {/* Contact Number */}
            <View className="border-b border-gray-100 pb-3">
              <Text className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                Contact Number
              </Text>
              <Text className="text-base text-gray-800 mt-1">
                {user.contact_number || 'Not provided'}
              </Text>
            </View>

            {/* Address */}
            <View className="border-b border-gray-100 pb-3">
              <Text className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                Address
              </Text>
              <Text className="text-base text-gray-800 mt-1">
                {user.address || 'Not provided'}
              </Text>
            </View>

            {/* Member Since */}
            {user.created_at && (
              <View>
                <Text className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Member Since
                </Text>
                <Text className="text-base text-gray-800 mt-1">
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          onPress={handleLogout} 
          className="mt-6 bg-red-500 py-4 rounded-2xl"
        >
          <Text className="text-white text-center font-semibold text-lg">Log Out</Text>
        </TouchableOpacity>

        <View className="h-8" />
        </ResponsiveContainer>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal 
        visible={isEditing} 
        animationType="slide" 
        transparent={true} 
        onRequestClose={() => setIsEditing(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="bg-white rounded-t-3xl p-6"
            style={{ maxHeight: isCompact ? '92%' : '80%', minHeight: isCompact ? '70%' : '60%' }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-gray-800">Edit Profile</Text>
              <TouchableOpacity onPress={() => setIsEditing(false)} className="p-2">
                <Feather name="x" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="space-y-4">
                {/* First Name */}
                <View>
                  <Text className="text-gray-700 font-medium mb-1">First Name</Text>
                  <TextInput
                    className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
                      editErrors.first_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    value={editForm.first_name || ''}
                    onChangeText={text => setEditForm(prev => ({ ...prev, first_name: text }))}
                  />
                  {editErrors.first_name && (
                    <Text className="text-red-500 text-xs mt-1">{editErrors.first_name}</Text>
                  )}
                </View>

                {/* Last Name */}
                <View>
                  <Text className="text-gray-700 font-medium mb-1">Last Name</Text>
                  <TextInput
                    className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
                      editErrors.last_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    value={editForm.last_name || ''}
                    onChangeText={text => setEditForm(prev => ({ ...prev, last_name: text }))}
                  />
                  {editErrors.last_name && (
                    <Text className="text-red-500 text-xs mt-1">{editErrors.last_name}</Text>
                  )}
                </View>

                {/* Middle Name */}
                <View>
                  <Text className="text-gray-700 font-medium mb-1">Middle Name (Optional)</Text>
                  <TextInput
                    className="border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 border-gray-300"
                    value={editForm.middle_name || ''}
                    onChangeText={text => setEditForm(prev => ({ ...prev, middle_name: text }))}
                  />
                </View>

                {/* Contact Number */}
                <View>
                  <Text className="text-gray-700 font-medium mb-1">Contact Number</Text>
                  <TextInput
                    className={`border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 ${
                      editErrors.contact_number ? 'border-red-500' : 'border-gray-300'
                    }`}
                    value={editForm.contact_number || ''}
                    onChangeText={text => setEditForm(prev => ({ ...prev, contact_number: text }))}
                    keyboardType="phone-pad"
                    placeholder="09XX XXX XXXX"
                  />
                  {editErrors.contact_number && (
                    <Text className="text-red-500 text-xs mt-1">{editErrors.contact_number}</Text>
                  )}
                </View>

                {/* Address */}
                <View>
                  <Text className="text-gray-700 font-medium mb-1">Address</Text>
                  <TextInput
                    className="border rounded-xl px-4 py-3 text-gray-800 bg-gray-50 border-gray-300"
                    value={editForm.address || ''}
                    onChangeText={text => setEditForm(prev => ({ ...prev, address: text }))}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>

              <ResponsiveRow className="mt-8 mb-4">
                <TouchableOpacity 
                  onPress={() => setIsEditing(false)} 
                  className="flex-1 bg-gray-200 py-3 rounded-xl"
                >
                  <Text className="text-gray-700 text-center font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveProfile}
                  disabled={loading}
                  className={`flex-1 py-3 rounded-xl ${loading ? 'bg-blue-400' : 'bg-blue-600'}`}
                >
                  <Text className="text-white text-center font-semibold">
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </ResponsiveRow>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}