import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DatePickerCalendarProps {
  selectedMonth: Date;
  selectedDate?: string;
  onMonthChange: (increment: number) => void;
  onDateSelect: (day: number) => void;
  isDateDisabled?: (year: number, month: number, day: number) => boolean;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function DatePickerCalendar({
  selectedMonth,
  selectedDate,
  onMonthChange,
  onDateSelect,
  isDateDisabled = () => false,
}: DatePickerCalendarProps) {
  const isWeb = Platform.OS === 'web';
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const cells: React.ReactNode[] = [];

  WEEKDAYS.forEach((day, index) => {
    cells.push(
      <View key={`header-${index}`} style={{ width: '14.28%', aspectRatio: 1 }} className="justify-center items-center">
        <Text className="text-xs font-semibold text-gray-500">{day}</Text>
      </View>
    );
  });

  for (let i = 0; i < firstDay; i++) {
    cells.push(<View key={`empty-${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const disabled = isDateDisabled(year, month, day);
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isSelected = selectedDate === dateString;

    cells.push(
      <TouchableOpacity
        key={`day-${day}`}
        onPress={() => !disabled && onDateSelect(day)}
        disabled={disabled}
        style={{ width: '14.28%', aspectRatio: 1, ...(isWeb ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as object) : {}) }}
        className="justify-center items-center p-0.5"
      >
        <View
          className={`w-full h-full justify-center items-center rounded-full ${
            disabled ? 'bg-gray-100' : isSelected ? 'bg-blue-600' : 'bg-white'
          }`}
        >
          <Text
            className={`text-sm ${
              disabled ? 'text-gray-400' : isSelected ? 'text-white font-bold' : 'text-gray-700'
            }`}
          >
            {day}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View className="mt-2">
      <View className="flex-row justify-between items-center mb-4 px-2">
        <TouchableOpacity onPress={() => onMonthChange(-1)} className="p-2">
          <Feather name="chevron-left" size={22} color="#4B5563" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800">
          {selectedMonth.toLocaleString('default', { month: 'long' })} {year}
        </Text>
        <TouchableOpacity onPress={() => onMonthChange(1)} className="p-2">
          <Feather name="chevron-right" size={22} color="#4B5563" />
        </TouchableOpacity>
      </View>
      <View className="flex-row flex-wrap">{cells}</View>
    </View>
  );
}
