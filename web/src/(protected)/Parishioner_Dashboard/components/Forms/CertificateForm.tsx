import React, { useState, useEffect, useMemo } from 'react';
import {
  certificateFormAPI,
  getCertificateTypeFromService,
  getServiceIdForCertificateType,
  type CertificateType,
  type CreateCertificateFormData,
  type UpdateCertificateFormData,
} from '../../../../../library/certificate-form';
import { churchServiceAPI, type ChurchService } from '../../../../../library/church_service';

interface CertificateFormProps {
  initialData?: Partial<CreateCertificateFormData>;
  certificateId?: number;
  isEdit?: boolean;
  onSubmit?: (data: CreateCertificateFormData) => void;
  onUpdate?: (id: number, data: UpdateCertificateFormData) => void;
  onCancel?: () => void;
  onSuccess?: () => void;
}

interface ErrorResponse {
  response?: {
    data?: {
      message?: string;
      errors?: Record<string, string[]>;
    };
  };
}

const preferredTimeOptions = [
  { label: '8:00 AM', value: '08:00' },
  { label: '9:00 AM', value: '09:00' },
  { label: '10:00 AM', value: '10:00' },
  { label: '11:00 AM', value: '11:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '1:00 PM', value: '13:00' },
  { label: '2:00 PM', value: '14:00' },
  { label: '3:00 PM', value: '15:00' },
  { label: '4:00 PM', value: '16:00' },
  { label: '5:00 PM', value: '17:00' },
];

const emptyForm = (serviceId = 0): CreateCertificateFormData => ({
  service_id: serviceId,
  full_name: '',
  address: '',
  contact_number: '',
  birth_date: null,
  marriage_date: null,
  preferred_date: '',
  preferred_time: '',
});

const CertificateForm: React.FC<CertificateFormProps> = ({
  initialData = {},
  certificateId,
  isEdit = false,
  onSubmit,
  onUpdate,
  onCancel,
  onSuccess,
}) => {
  const [certificateServices, setCertificateServices] = useState<ChurchService[]>([]);
  const [formData, setFormData] = useState<CreateCertificateFormData>({
    ...emptyForm(),
    ...initialData,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const selectedType: CertificateType = useMemo(() => {
    const service = certificateServices.find((s) => s.service_id === formData.service_id);
    if (service?.service_name) {
      return getCertificateTypeFromService(service.service_name) || 'baptismal';
    }
    return 'baptismal';
  }, [certificateServices, formData.service_id]);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const response = await churchServiceAPI.getAll({ type: 'certificate' });
        if (response.data?.success) {
          const services = response.data.data?.data || [];
          setCertificateServices(services);
          console.log('Certificate services loaded:', services);

          if (!formData.service_id && services.length > 0) {
            const baptismalId = getServiceIdForCertificateType(services, 'baptismal');
            if (baptismalId) {
              setFormData((prev) => ({ ...prev, service_id: baptismalId }));
            }
          }
        }
      } catch (error) {
        console.error('Error loading certificate services:', error);
      }
    };

    loadServices();
  }, []);

  useEffect(() => {
    if (isEdit && certificateId) {
      loadCertificateData();
    }
  }, [isEdit, certificateId]);

  const loadCertificateData = async () => {
    setIsLoading(true);
    try {
      const response = await certificateFormAPI.getById(certificateId!);
      if (response.data.success) {
        const data = response.data.data;
        setFormData({
          service_id: data.service_id,
          full_name: data.full_name,
          address: data.address,
          contact_number: data.contact_number,
          birth_date: data.birth_date || null,
          marriage_date: data.marriage_date || null,
          preferred_date: data.preferred_date || '',
          preferred_time: data.preferred_time || '',
        });
      }
    } catch (error) {
      console.error('Error loading certificate data:', error);
      setSubmitError('Failed to load certificate form data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === '' ? null : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleCertificateTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as CertificateType;
    const serviceId = getServiceIdForCertificateType(certificateServices, type);
    if (!serviceId) {
      setErrors((prev) => ({ ...prev, service_id: 'Certificate service not found' }));
      return;
    }
    setFormData((prev) => ({ ...prev, service_id: serviceId }));
    if (errors.service_id) {
      setErrors((prev) => ({ ...prev, service_id: '' }));
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const requiredFields = [
      'full_name',
      'address',
      'contact_number',
      'preferred_date',
      'preferred_time',
    ];

    if (!value && requiredFields.includes(name)) {
      const fieldLabels: Record<string, string> = {
        full_name: 'Full name',
        address: 'Address',
        contact_number: 'Contact number',
        birth_date: 'Birth date',
        marriage_date: 'Marriage date',
        preferred_date: 'Preferred date',
        preferred_time: 'Preferred time',
      };
      setErrors((prev) => ({
        ...prev,
        [name]: `${fieldLabels[name]} is required`,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.service_id) {
      newErrors.service_id = 'Certificate type is required';
    }
    if (!formData.full_name?.trim()) {
      newErrors.full_name = 'Full name is required';
    }
    if (!formData.address?.trim()) {
      newErrors.address = 'Address is required';
    }
    if (!formData.contact_number?.trim()) {
      newErrors.contact_number = 'Contact number is required';
    }
    if (!formData.preferred_date) {
      newErrors.preferred_date = 'Preferred date is required';
    }
    if (!formData.preferred_time) {
      newErrors.preferred_time = 'Preferred time is required';
    }

    if (selectedType === 'baptismal' && !formData.birth_date) {
      newErrors.birth_date = 'Birth date is required for baptismal certificate';
    }
    if (selectedType === 'marriage' && !formData.marriage_date) {
      newErrors.marriage_date = 'Marriage date is required for marriage certificate';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!validateForm()) {
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const element = document.getElementsByName(firstErrorField)[0];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
        }
      }
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && certificateId) {
        const updateData: UpdateCertificateFormData = {
          service_id: formData.service_id,
          full_name: formData.full_name,
          address: formData.address,
          contact_number: formData.contact_number,
          birth_date: formData.birth_date,
          marriage_date: formData.marriage_date,
          preferred_date: formData.preferred_date,
          preferred_time: formData.preferred_time,
        };

        if (onUpdate) {
          await onUpdate(certificateId, updateData);
        } else {
          await certificateFormAPI.update(certificateId, updateData);
        }
        setSubmitSuccess(true);
      } else {
        if (onSubmit) {
          await onSubmit(formData);
        } else {
          await certificateFormAPI.create(formData);
        }
        setSubmitSuccess(true);
        const defaultServiceId =
          getServiceIdForCertificateType(certificateServices, 'baptismal') || 0;
        setFormData(emptyForm(defaultServiceId));
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: unknown) {
      console.error('Error submitting certificate form:', error);
      const err = error as ErrorResponse;
      setSubmitError(
        err.response?.data?.message || 'Failed to submit certificate form. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    const defaultServiceId =
      getServiceIdForCertificateType(certificateServices, 'baptismal') || 0;
    setFormData(emptyForm(defaultServiceId));
    setErrors({});
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {submitSuccess && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          Certificate form {isEdit ? 'updated' : 'created'} successfully!
        </div>
      )}

      {submitError && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Certificate Details</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Certificate Type *
            </label>
            <select
              name="certificate_type"
              value={selectedType}
              onChange={handleCertificateTypeChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.service_id ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="baptismal">Baptismal Certificate</option>
              <option value="marriage">Marriage Certificate</option>
            </select>
            {errors.service_id && (
              <p className="mt-1 text-sm text-red-600">{errors.service_id}</p>
            )}
          </div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Personal Information</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name || ''}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.full_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter full name"
            />
            {errors.full_name && (
              <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
            )}
          </div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Date Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {selectedType === 'baptismal' ? 'Birth Date *' : 'Birth Date'}
              </label>
              <input
                type="date"
                name="birth_date"
                value={formData.birth_date || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.birth_date ? 'border-red-500' : 'border-gray-300'
                }`}
                max={new Date().toISOString().split('T')[0]}
              />
              {errors.birth_date && (
                <p className="mt-1 text-sm text-red-600">{errors.birth_date}</p>
              )}
              {selectedType === 'baptismal' && (
                <p className="mt-1 text-xs text-gray-500">Required for baptismal certificate</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {selectedType === 'marriage' ? 'Marriage Date *' : 'Marriage Date'}
              </label>
              <input
                type="date"
                name="marriage_date"
                value={formData.marriage_date || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.marriage_date ? 'border-red-500' : 'border-gray-300'
                }`}
                max={new Date().toISOString().split('T')[0]}
              />
              {errors.marriage_date && (
                <p className="mt-1 text-sm text-red-600">{errors.marriage_date}</p>
              )}
              {selectedType === 'marriage' && (
                <p className="mt-1 text-xs text-gray-500">Required for marriage certificate</p>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Preferred Schedule</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Date *
              </label>
              <input
                type="date"
                name="preferred_date"
                value={formData.preferred_date || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.preferred_date ? 'border-red-500' : 'border-gray-300'
                }`}
                min={new Date().toISOString().split('T')[0]}
              />
              {errors.preferred_date && (
                <p className="mt-1 text-sm text-red-600">{errors.preferred_date}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Time *
              </label>
              <select
                name="preferred_time"
                value={formData.preferred_time || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.preferred_time ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select preferred time</option>
                {preferredTimeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.preferred_time && (
                <p className="mt-1 text-sm text-red-600">{errors.preferred_time}</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
              <textarea
                name="address"
                value={formData.address || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.address ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter complete address"
              />
              {errors.address && (
                <p className="mt-1 text-sm text-red-600">{errors.address}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Number *
              </label>
              <input
                type="tel"
                name="contact_number"
                value={formData.contact_number || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.contact_number ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter contact number"
              />
              {errors.contact_number && (
                <p className="mt-1 text-sm text-red-600">{errors.contact_number}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
          <p className="text-sm text-gray-600">
            <strong>Type:</strong>{' '}
            {selectedType === 'baptismal' ? 'Baptismal Certificate' : 'Marriage Certificate'}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Name:</strong> {formData.full_name || 'Not provided'}
          </p>
          {selectedType === 'baptismal' && formData.birth_date && (
            <p className="text-sm text-gray-600">
              <strong>Birth Date:</strong> {new Date(formData.birth_date).toLocaleDateString()}
            </p>
          )}
          {selectedType === 'marriage' && formData.marriage_date && (
            <p className="text-sm text-gray-600">
              <strong>Marriage Date:</strong>{' '}
              {new Date(formData.marriage_date).toLocaleDateString()}
            </p>
          )}
          {formData.preferred_date && (
            <p className="text-sm text-gray-600">
              <strong>Preferred Date:</strong>{' '}
              {new Date(formData.preferred_date).toLocaleDateString()}
            </p>
          )}
          {formData.preferred_time && (
            <p className="text-sm text-gray-600">
              <strong>Preferred Time:</strong>{' '}
              {preferredTimeOptions.find((opt) => opt.value === formData.preferred_time)?.label ||
                formData.preferred_time}
            </p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Reset
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Submitting...
              </span>
            ) : isEdit ? (
              'Update Certificate Form'
            ) : (
              'Create Certificate Form'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CertificateForm;
