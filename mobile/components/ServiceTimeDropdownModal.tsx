import React from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Platform } from 'react-native';
import { SERVICE_TIME_OPTIONS } from '../constants/serviceTimeOptions';

interface ServiceTimeDropdownModalProps {
  visible: boolean;
  selectedValue: string;
  bookedSlots?: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
}

const ServiceTimeDropdownModal: React.FC<ServiceTimeDropdownModalProps> = ({
  visible,
  selectedValue,
  bookedSlots = [],
  onSelect,
  onClose,
}) => {
  const isWeb = Platform.OS === 'web';
  const bookedSet = new Set(bookedSlots);

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
            data={SERVICE_TIME_OPTIONS}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const isBooked = bookedSet.has(item.value);
              const isSelected = selectedValue === item.value;

              return (
                <TouchableOpacity
                  onPress={() => {
                    if (isBooked) return;
                    onSelect(item.value);
                    onClose();
                  }}
                  disabled={isBooked}
                  className={`py-4 px-4 rounded-xl mb-1 ${
                    isBooked
                      ? 'bg-gray-100 opacity-60'
                      : isSelected
                      ? 'bg-blue-500'
                      : 'bg-gray-50'
                  }`}
                >
                  <Text
                    className={`text-center text-base font-medium ${
                      isBooked
                        ? 'text-gray-400'
                        : isSelected
                        ? 'text-white'
                        : 'text-gray-700'
                    }`}
                  >
                    {item.label}
                    {isBooked ? ' (Booked)' : ''}
                  </Text>
                </TouchableOpacity>
              );
            }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      </View>
    </Modal>
  );
};

export default ServiceTimeDropdownModal;
