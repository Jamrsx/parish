import React from 'react';
import {
  Church,
  Cross,
  Droplets,
  Heart,
  Home,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';

export type ServiceIconKey =
  | 'baptism'
  | 'funeral'
  | 'marriage'
  | 'blessing'
  | 'certificate'
  | 'service'
  | 'church';

const ICON_MAP: Record<ServiceIconKey, LucideIcon> = {
  baptism: Droplets,
  funeral: Cross,
  marriage: Heart,
  blessing: Home,
  certificate: ScrollText,
  service: Church,
  church: Church,
};

export function resolveServiceIconKey(
  serviceName?: string,
  formType?: string | null
): ServiceIconKey {
  const name = (serviceName || '').toLowerCase();

  if (name.includes('baptism') && !name.includes('certificate')) return 'baptism';
  if (name.includes('funeral')) return 'funeral';
  if (name.includes('marriage') && !name.includes('certificate')) return 'marriage';
  if (name.includes('house blessing') || name.includes('blessing')) return 'blessing';
  if (name.includes('certificate') || name.includes('baptismal')) return 'certificate';

  if (formType === 'baptism') return 'baptism';
  if (formType === 'service') return 'service';
  if (formType === 'certificate') return 'certificate';

  return 'church';
}

interface ServiceTypeIconProps {
  serviceName?: string;
  formType?: string | null;
  className?: string;
  size?: number;
}

export const ServiceTypeIcon: React.FC<ServiceTypeIconProps> = ({
  serviceName,
  formType,
  className = 'text-blue-600',
  size = 20,
}) => {
  const key = resolveServiceIconKey(serviceName, formType);
  const Icon = ICON_MAP[key];
  return <Icon className={className} size={size} aria-hidden />;
};

export function getFilterServiceIcon(formType: string): LucideIcon {
  switch (formType) {
    case 'baptism':
      return Cross;
    case 'service':
      return Church;
    case 'certificate':
      return ScrollText;
    default:
      return Church;
  }
}
