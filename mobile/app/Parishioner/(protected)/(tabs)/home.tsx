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
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../../../context/AuthContext';
import ResponsiveContainer from '../../../../components/ResponsiveContainer';
import ResponsiveGrid from '../../../../components/ResponsiveGrid';
import ParishionerHeader from '../../../../components/ParishionerHeader';
import { useResponsive } from '../../../../hooks/useResponsive';

export default function Home() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { isCompact, isLargeScreen } = useResponsive();

  const services = [
    {
      id: 1,
      title: 'Church Services',
      icon: 'church' as const,
      description: 'Request baptism, marriage, funeral, and house blessing',
      initialView: 'services',
    },
    {
      id: 2,
      title: 'Sacramental Certificates',
      icon: 'file-alt' as const,
      description: 'Request baptismal certificate and marriage certificate',
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

  console.log('Home screen rendered', { isCompact, isLargeScreen });

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View className="flex-1">
        <ParishionerHeader title="SAN GUILLERMO PARISH" subtitle="Parishioner Portal" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View className={`bg-blue-600 ${isCompact ? 'px-4 py-7' : 'px-6 py-9'}`}>
            <View className="items-center">
              <Text className={`text-white font-bold mb-2 text-center ${isCompact ? 'text-2xl' : 'text-3xl'}`}>
                Welcome back!
              </Text>
              <Text className={`text-white font-semibold mb-2 text-center ${isCompact ? 'text-lg' : 'text-xl'}`}>
                {user.first_name} {user.last_name}
              </Text>
              <Text className="text-blue-200 text-base text-center">
                Manage Church Services Efficiently
              </Text>
            </View>
          </View>

          <ResponsiveContainer className="py-8">
            <Text className={`font-bold text-gray-800 mb-2 text-center ${isCompact ? 'text-xl' : 'text-2xl'}`}>
              Our Services
            </Text>
            <Text className="text-gray-600 text-center mb-8">
              Choose from our spiritual services below
            </Text>

            <ResponsiveGrid>
              {services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  className="bg-white border border-blue-200 rounded-2xl p-5 mb-1 shadow-sm"
                  onPress={() => router.push(`./church_service?initialView=${service.initialView}`)}
                  activeOpacity={0.7}
                >
                  <View className="items-center">
                    <View className="w-14 h-14 rounded-full bg-blue-50 items-center justify-center mb-3">
                      <FontAwesome5 name={service.icon} size={22} color="#2563EB" />
                    </View>
                    <Text className="text-lg font-bold text-gray-800 mb-2 text-center">{service.title}</Text>
                    <Text className="text-gray-600 text-center text-sm">{service.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ResponsiveGrid>
          </ResponsiveContainer>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
