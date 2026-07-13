import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ScrollView,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COLUMNS = 7;
const MAX_CALENDAR_WIDTH = 400;

interface DatePickerCalendarProps {
  selectedMonth: Date;
  selectedDate?: string;
  onMonthChange: (increment: number) => void;
  onYearChange?: (year: number) => void;
  onDateSelect: (day: number) => void;
  isDateDisabled?: (year: number, month: number, day: number) => boolean;
  enableYearPicker?: boolean;
  minYear?: number;
  maxYear?: number;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function buildCalendarWeeks(
  year: number,
  month: number
): (number | null)[][] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    week.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === COLUMNS) {
      weeks.push(week);
      week = [];
    }
  }

  if (week.length > 0) {
    while (week.length < COLUMNS) {
      week.push(null);
    }
    weeks.push(week);
  }

  return weeks;
}

export default function DatePickerCalendar({
  selectedMonth,
  selectedDate,
  onMonthChange,
  onYearChange,
  onDateSelect,
  isDateDisabled = () => false,
  enableYearPicker = false,
  minYear,
  maxYear,
}: DatePickerCalendarProps) {
  const isWeb = Platform.OS === 'web';
  const { width: screenWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const [showYearList, setShowYearList] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearMin = minYear ?? currentYear - 100;
  const yearMax = maxYear ?? currentYear;

  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();

  const calendarWidth = useMemo(() => {
    const measured = containerWidth > 0 ? containerWidth : Math.min(screenWidth - 48, MAX_CALENDAR_WIDTH);
    return Math.min(measured, MAX_CALENDAR_WIDTH);
  }, [containerWidth, screenWidth]);

  const cellSize = Math.floor(calendarWidth / COLUMNS);
  const rowHeight = Math.max(40, Math.min(cellSize, 48));

  const weeks = useMemo(() => buildCalendarWeeks(year, month), [year, month]);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = yearMax; y >= yearMin; y--) {
      list.push(y);
    }
    return list;
  }, [yearMin, yearMax]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0) {
      setContainerWidth(width);
    }
  }, []);

  useEffect(() => {
    setShowYearList(false);
  }, [year, month]);

  const handleYearSelect = (selectedYear: number) => {
    console.log('DatePickerCalendar year selected:', selectedYear);
    onYearChange?.(selectedYear);
    setShowYearList(false);
  };

  const renderDayCell = (day: number | null, key: string) => {
    if (day === null) {
      return (
        <View
          key={key}
          style={{ width: cellSize, height: rowHeight }}
        />
      );
    }

    const disabled = isDateDisabled(year, month, day);
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isSelected = selectedDate === dateString;

    return (
      <TouchableOpacity
        key={key}
        onPress={() => !disabled && onDateSelect(day)}
        disabled={disabled}
        style={{
          width: cellSize,
          height: rowHeight,
          justifyContent: 'center',
          alignItems: 'center',
          ...(isWeb ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as object) : {}),
        }}
        activeOpacity={0.7}
      >
        <View
          style={{
            width: Math.min(rowHeight - 6, 40),
            height: Math.min(rowHeight - 6, 40),
            borderRadius: 999,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: disabled ? '#F3F4F6' : isSelected ? '#2563EB' : 'transparent',
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: isSelected ? '700' : '500',
              color: disabled ? '#9CA3AF' : isSelected ? '#FFFFFF' : '#374151',
            }}
          >
            {day}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (showYearList && enableYearPicker) {
    return (
      <View className="mt-2" onLayout={handleLayout}>
        <View className="flex-row items-center mb-3 px-1">
          <TouchableOpacity onPress={() => setShowYearList(false)} className="flex-row items-center gap-1 p-2">
            <Feather name="arrow-left" size={18} color="#2563EB" />
            <Text className="text-blue-600 font-semibold">Back to calendar</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-center text-lg font-bold text-gray-800 mb-3">Select Year</Text>
        <ScrollView
          style={{ maxHeight: 280 }}
          showsVerticalScrollIndicator
          contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 12 }}
        >
          <View className="flex-row flex-wrap justify-center" style={{ gap: 8 }}>
            {years.map((y) => {
              const isActive = y === year;
              const yearCellWidth = Math.max(72, Math.floor((calendarWidth - 24) / 4));
              return (
                <TouchableOpacity
                  key={y}
                  onPress={() => handleYearSelect(y)}
                  style={{ width: yearCellWidth }}
                  className={`py-3 rounded-xl items-center ${
                    isActive ? 'bg-blue-600' : 'bg-gray-100'
                  }`}
                >
                  <Text className={`font-semibold ${isActive ? 'text-white' : 'text-gray-800'}`}>
                    {y}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="mt-2 items-center" onLayout={handleLayout}>
      <View style={{ width: calendarWidth, maxWidth: '100%' }}>
        <View className="flex-row justify-between items-center mb-3 px-1">
          <TouchableOpacity onPress={() => onMonthChange(-1)} className="p-2">
            <Feather name="chevron-left" size={22} color="#4B5563" />
          </TouchableOpacity>

          <View className="flex-row items-center justify-center flex-1">
            <Text className="text-base font-semibold text-gray-800">
              {selectedMonth.toLocaleString('default', { month: 'long' })}{' '}
            </Text>
            {enableYearPicker ? (
              <TouchableOpacity
                onPress={() => {
                  console.log('DatePickerCalendar opening year list');
                  setShowYearList(true);
                }}
                className="flex-row items-center px-2 py-1 rounded-lg bg-blue-50"
                activeOpacity={0.7}
              >
                <Text className="text-base font-bold text-blue-600">{year}</Text>
                <Feather name="chevron-down" size={16} color="#2563EB" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            ) : (
              <Text className="text-base font-semibold text-gray-800">{year}</Text>
            )}
          </View>

          <TouchableOpacity onPress={() => onMonthChange(1)} className="p-2">
            <Feather name="chevron-right" size={22} color="#4B5563" />
          </TouchableOpacity>
        </View>

        {/* Weekday headers */}
        <View style={{ flexDirection: 'row', width: calendarWidth }}>
          {WEEKDAYS.map((day, index) => (
            <View
              key={`header-${index}`}
              style={{
                width: cellSize,
                height: 28,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text className="text-xs font-semibold text-gray-500">{day}</Text>
            </View>
          ))}
        </View>

        {/* Date rows */}
        {weeks.map((week, weekIndex) => (
          <View
            key={`week-${weekIndex}`}
            style={{ flexDirection: 'row', width: calendarWidth }}
          >
            {week.map((day, dayIndex) =>
              renderDayCell(day, `week-${weekIndex}-day-${dayIndex}`)
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
