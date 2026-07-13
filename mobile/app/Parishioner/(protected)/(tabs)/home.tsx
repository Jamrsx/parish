import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const services = [
    {
      id: 1,
      title: 'Church Services',
      icon: '💧',
      description: 'Request baptism, marriage, funeral, and house blessing',
      color: 'bg-blue-50',
      borderColor: 'border-blue-200',
      initialView: 'services',
    },
    {
      id: 2,
      title: 'Sacramental Certificates',
      icon: '💑',
      description: 'Request baptismal certificate, and marriage certificate',
      color: 'bg-pink-50',
      borderColor: 'border-pink-200',
      initialView: 'certificates',
    },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-gray-50"
      edges={['top','left', 'right']}
    >
      <StatusBar  style="dark" />
      <View style={{ flex: 1 }}>
        {/* Navigation Header */}
        <View className="bg-white px-5 py-3 border-b border-gray-200">
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <View className="w-14 h-14 rounded-full items-center justify-center overflow-hidden bg-blue-100">
                <Text className="text-3xl">⛪</Text>
              </View>
              <View>
                <Text className="pl-1 text-xl font-bold text-gray-800">SAN GUILLERMO PARISH</Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {/* Hero Section */}
          <View className="bg-blue-600 px-6 py-9">
            <View className="items-center">
              <Text className="text-white text-5xl mb-4">🙏</Text>
              <Text className="text-white text-4xl font-bold mb-3 text-center">Welcome back!</Text>
              <Text className="text-white text-2xl font-semibold mb-2 text-center">
                {user.first_name} {user.last_name}
              </Text>
              <Text className="text-blue-200 text-lg text-center">Manage Church Services Efficiently</Text>
            </View>
          </View>

          {/* Services Section */}
          <View className="px-6 py-12">
            <Text className="text-3xl font-bold text-gray-800 mb-2 text-center">Our Services</Text>
            <Text className="text-gray-600 text-center mb-10">Choose from our spiritual services below</Text>

            <View className="flex-row flex-wrap justify-between">
              {services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  className={`${service.color} border ${service.borderColor} w-[48%] rounded-2xl p-6 mb-4`}
                  onPress={() => router.push(`./church_service?initialView=${service.initialView}`)}
                  activeOpacity={0.7}
                >
                  <View className="items-center">
                    <Text className="text-5xl mb-3">{service.icon}</Text>
                    <Text className="text-xl font-bold text-gray-800 mt-2 mb-2 text-center">{service.title}</Text>
                    <Text className="text-gray-600 text-center text-sm">{service.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}