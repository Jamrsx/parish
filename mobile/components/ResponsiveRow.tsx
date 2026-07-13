import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';

interface ResponsiveRowProps extends ViewProps {
  children: React.ReactNode;
  gap?: number;
  stackOnCompact?: boolean;
  className?: string;
}

export default function ResponsiveRow({
  children,
  gap = 12,
  stackOnCompact = true,
  className = '',
  style,
  ...props
}: ResponsiveRowProps) {
  const { isCompact } = useResponsive();
  const shouldStack = stackOnCompact && isCompact;

  return (
    <View
      className={className}
      style={[
        {
          flexDirection: shouldStack ? 'column' : 'row',
          gap,
        },
        style,
      ]}
      {...props}
    >
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return null;
        return (
          <View
            key={index}
            style={shouldStack ? { width: '100%' } : { flex: 1, minWidth: 0 }}
          >
            {child}
          </View>
        );
      })}
    </View>
  );
}
