import { FontAwesome5 } from '@expo/vector-icons';

type IconName = keyof typeof FontAwesome5.glyphMap;

/** Icon names saved from Manage Services (must match ICON_OPTIONS on the web). */
const SERVICE_ICON_MAP: Record<string, IconName> = {
  Church: 'church',
  Home: 'home',
  Heart: 'heart',
  Cross: 'cross',
  Droplets: 'tint',
  BookOpen: 'book-open',
  FileText: 'file-alt',
  Star: 'star',
  Users: 'users',
  Candle: 'fire',
};

export const getServiceIconName = (icon?: string | null, fallback: IconName = 'church'): IconName =>
  (icon && SERVICE_ICON_MAP[icon]) || fallback;
