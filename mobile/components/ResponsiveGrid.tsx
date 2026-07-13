import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';

interface ResponsiveGridProps extends ViewProps {
  children: React.ReactNode;
  columns?: number;
  className?: string;
}

export default function ResponsiveGrid({
  children,
  columns,
  className = '',
  style,
  ...props
}: ResponsiveGridProps) {
  const { gridColumns, gridGap, getItemWidth } = useResponsive();
  const cols = columns ?? gridColumns;
  const itemWidth = getItemWidth(cols, gridGap);

  return (
    <View
      className={`flex-row flex-wrap ${className}`}
      style={[{ gap: gridGap }, style]}
      {...props}
    >
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return null;
        return (
          <View key={index} style={{ width: itemWidth }}>
            {child}
          </View>
        );
      })}
    </View>
  );
}
