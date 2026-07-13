import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';

interface ResponsiveContainerProps extends ViewProps {
  children: React.ReactNode;
  centered?: boolean;
  noPadding?: boolean;
  className?: string;
}

export default function ResponsiveContainer({
  children,
  centered = true,
  noPadding = false,
  className = '',
  style,
  ...props
}: ResponsiveContainerProps) {
  const { contentMaxWidth, contentPadding, isLargeScreen } = useResponsive();

  return (
    <View
      className={`w-full ${centered ? 'items-center' : ''} ${className}`}
      style={style}
      {...props}
    >
      <View
        className="w-full"
        style={{
          maxWidth: isLargeScreen ? contentMaxWidth : undefined,
          paddingHorizontal: noPadding ? 0 : contentPadding,
          flex: 1,
        }}
      >
        {children}
      </View>
    </View>
  );
}
