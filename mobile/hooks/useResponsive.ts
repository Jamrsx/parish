import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import {
  COMPACT_MAX,
  CONTENT_MAX_WIDTH,
  GRID_GAP,
  TABLET_MIN,
  getContentPadding,
  getGridColumns,
  getGridItemWidth,
} from '../constants/layout';

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isCompact = width < COMPACT_MAX;
    const isTablet = width >= TABLET_MIN;
    const isWeb = Platform.OS === 'web';
    const isLargeScreen = isTablet || (isWeb && width >= 600);
    const gridColumns = getGridColumns(width);
    const contentPadding = getContentPadding(width);

    const getItemWidth = (columns?: number, gap: number = GRID_GAP) =>
      getGridItemWidth(width, columns ?? gridColumns, gap, contentPadding * 2, CONTENT_MAX_WIDTH);

    return {
      width,
      height,
      isCompact,
      isTablet,
      isWeb,
      isLargeScreen,
      gridColumns,
      contentPadding,
      contentMaxWidth: CONTENT_MAX_WIDTH,
      gridGap: GRID_GAP,
      getItemWidth,
    };
  }, [width, height]);
}
