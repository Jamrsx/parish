import type { ManageRequest } from '../../../../../library/manage-request';

type RequestWithContact = Pick<
  ManageRequest,
  'baptismForm' | 'serviceForm' | 'certificateForm' | 'user'
>;

/**
 * Prefer the contact number entered on the submitted form
 * (baptism / service / certificate), then fall back to account profile.
 */
export const getRequestContactNumber = (request?: RequestWithContact | null): string => {
  if (!request) return 'N/A';

  const formContact =
    request.baptismForm?.contact_number ||
    request.serviceForm?.contact_number ||
    request.certificateForm?.contact_number;

  return formContact || request.user?.contact_number || request.user?.email || 'N/A';
};

export const formatPhilippinePhone = (value?: string | null): string => {
  if (!value || value === 'N/A') return value || 'N/A';

  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('09')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  return value;
};

export const getFormattedRequestContactNumber = (request?: RequestWithContact | null): string => {
  return formatPhilippinePhone(getRequestContactNumber(request));
};

export const isParishResident = (value?: boolean | number | string | null): boolean => {
  if (value === false || value === 0 || value === '0' || value === 'false') {
    return false;
  }
  return true;
};

export const getResidencyLabel = (isResident?: boolean | number | string | null): string =>
  isParishResident(isResident) ? 'Resident' : 'Non-resident';

export const shouldShowNonResidentAddress = (
  isResident?: boolean | number | string | null,
  address?: string | null
): boolean => {
  if (isParishResident(isResident)) return false;
  return Boolean(address && address !== 'Parish resident');
};

export const getRequestFormAddress = (request?: {
  baptismForm?: { address?: string } | null;
  serviceForm?: { address?: string } | null;
  certificateForm?: { address?: string } | null;
  user?: { address?: string | null } | null;
} | null): string => {
  if (!request) return '';
  return (
    request.baptismForm?.address ||
    request.serviceForm?.address ||
    request.certificateForm?.address ||
    request.user?.address ||
    ''
  );
};

/** Split "Husband & Wife" (or similar) into separate names for display. */
export const splitCoupleNames = (
  fullName?: string | null
): { husband: string; wife: string } => {
  const raw = (fullName || '').trim();
  if (!raw) return { husband: 'N/A', wife: 'N/A' };

  const separators = [' & ', ' and ', ' And ', ' AND '];
  for (const sep of separators) {
    const idx = raw.indexOf(sep);
    if (idx > 0) {
      return {
        husband: raw.slice(0, idx).trim() || 'N/A',
        wife: raw.slice(idx + sep.length).trim() || 'N/A',
      };
    }
  }

  return { husband: raw, wife: 'N/A' };
};
