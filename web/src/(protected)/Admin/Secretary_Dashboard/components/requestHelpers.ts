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
