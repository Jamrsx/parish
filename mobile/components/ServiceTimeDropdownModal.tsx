import React from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Platform } from 'react-native';
import { SERVICE_TIME_OPTIONS, isPastServiceTime, normalizeTimeValue } from '../constants/serviceTimeOptions';

interface ServiceTimeDropdownModalProps {
  visible: boolean;
  selectedValue: string;
  bookedSlots?: string[];
  selectedDate?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

const ServiceTimeDropdownModal: React.FC<ServiceTimeDropdownModalProps> = ({
  visible,
  selectedValue,
  bookedSlots = [],
  selectedDate,
  onSelect,
  onClose,
}) => {
  const isWeb = Platform.OS === 'web';
  const bookedSet = new Set(bookedSlots.map(normalizeTimeValue));

  const options = SERVICE_TIME_OPTIONS.map((item) => {
    const isBooked = bookedSet.has(item.value);
    const isPassed = !!selectedDate && isPastServiceTime(selectedDate, item.value);
    return { ...item, isBooked, isPassed, unavailable: isBooked || isPassed };
  });
  const hasOpenTime = options.some((item) => !item.unavailable);

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

          {!hasOpenTime && (
            <View className="mx-2 mb-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <Text className="text-sm text-amber-800">
                No open times left on this date. Please choose another date.
              </Text>
            </View>
          )}

          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const isSelected = selectedValue === item.value && !item.unavailable;

              return (
                <TouchableOpacity
                  onPress={() => {
                    if (item.unavailable) return;
                    console.log('ServiceTimeDropdownModal time selected:', { date: selectedDate, time: item.value });
                    onSelect(item.value);
                    onClose();
                  }}
                  disabled={item.unavailable}
                  accessibilityState={{ disabled: item.unavailable, selected: isSelected }}
                  className={`py-4 px-4 rounded-xl mb-1 ${
                    item.unavailable
                      ? 'bg-gray-100 opacity-60'
                      : isSelected
                      ? 'bg-blue-500'
                      : 'bg-gray-50'
                  }`}
                >
                  <Text
                    className={`text-center text-base font-medium ${
                      item.unavailable
                        ? 'text-gray-400'
                        : isSelected
                        ? 'text-white'
                        : 'text-gray-700'
                    }`}
                  >
                    {item.label}
                    {item.isBooked ? ' (Booked)' : item.isPassed ? ' (Passed)' : ''}
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
