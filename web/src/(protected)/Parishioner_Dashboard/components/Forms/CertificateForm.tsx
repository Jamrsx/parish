import React, { useState, useEffect } from 'react';
import { certificateFormAPI } from '../../../../../library/certificate-form';
import type { CreateCertificateFormData, UpdateCertificateFormData } from '../../../../../library/certificate-form';

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

// Preferred time options for dropdown
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

const CertificateForm: React.FC<CertificateFormProps> = ({
  initialData = {},
  certificateId,
  isEdit = false,
  onSubmit,
  onUpdate,
  onCancel,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<CreateCertificateFormData>({
    certificate_type: 'baptismal',
    full_name: '',
    address: '',
    contact_number: '',
    birth_date: null,
    marriage_date: null,
    preferred_date: '',
    preferred_time: '',
    ...initialData,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
          certificate_type: data.certificate_type,
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

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === '' ? null : value,
    }));
    // Clear error for this field when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Handle validation for a specific field on blur
  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const requiredFields = [
      'certificate_type',
      'full_name',
      'address',
      'contact_number',
      'preferred_date',
      'preferred_time',
    ];
    
    if (!value && requiredFields.includes(name)) {
      const fieldLabels: Record<string, string> = {
        certificate_type: 'Certificate type',
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

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.certificate_type) {
      newErrors.certificate_type = 'Certificate type is required';
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

    // Validate based on certificate type
    if (formData.certificate_type === 'baptismal' && !formData.birth_date) {
      newErrors.birth_date = 'Birth date is required for baptismal certificate';
    }
    if (formData.certificate_type === 'marriage' && !formData.marriage_date) {
      newErrors.marriage_date = 'Marriage date is required for marriage certificate';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
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
        // Update existing certificate form
        const updateData: UpdateCertificateFormData = {
          certificate_type: formData.certificate_type,
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
        // Create new certificate form
        if (onSubmit) {
          await onSubmit(formData);
        } else {
          await certificateFormAPI.create(formData);
        }
        setSubmitSuccess(true);
        // Reset form
        setFormData({
          certificate_type: 'baptismal',
          full_name: '',
          address: '',
          contact_number: '',
          birth_date: null,
          marriage_date: null,
          preferred_date: '',
          preferred_time: '',
        });
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

  // Reset form
  const handleReset = () => {
    setFormData({
      certificate_type: 'baptismal',
      full_name: '',
      address: '',
      contact_number: '',
      birth_date: null,
      marriage_date: null,
      preferred_date: '',
      preferred_time: '',
    });
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
        {/* Certificate Type Section */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Certificate Details</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Certificate Type *
            </label>
            <select
              name="certificate_type"
              value={formData.certificate_type}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.certificate_type ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="baptismal">Baptismal Certificate</option>
              <option value="marriage">Marriage Certificate</option>
            </select>
            {errors.certificate_type && (
              <p className="mt-1 text-sm text-red-600">{errors.certificate_type}</p>
            )}
          </div>
        </div>

        {/* Personal Information Section */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Personal Information</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
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

        {/* Date Information Section (Conditional) */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Date Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Birth Date - Required for Baptismal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.certificate_type === 'baptismal' ? 'Birth Date *' : 'Birth Date'}
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
              {formData.certificate_type === 'baptismal' && (
                <p className="mt-1 text-xs text-gray-500">Required for baptismal certificate</p>
              )}
            </div>

            {/* Marriage Date - Required for Marriage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.certificate_type === 'marriage' ? 'Marriage Date *' : 'Marriage Date'}
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
              {formData.certificate_type === 'marriage' && (
                <p className="mt-1 text-xs text-gray-500">Required for marriage certificate</p>
              )}
            </div>
          </div>
        </div>

        {/* ✅ Preferred Schedule Section with Dropdown */}
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

        {/* Contact Information Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address *
              </label>
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

        {/* Summary Section */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
          <p className="text-sm text-gray-600">
            <strong>Type:</strong> {formData.services_id === 'baptismal' ? 'Baptismal Certificate' : 'Marriage Certificate'}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Name:</strong> {formData.full_name || 'Not provided'}
          </p>
          {formData.certificate_type === 'baptismal' && formData.birth_date && (
            <p className="text-sm text-gray-600">
              <strong>Birth Date:</strong> {new Date(formData.birth_date).toLocaleDateString()}
            </p>
          )}
          {formData.certificate_type === 'marriage' && formData.marriage_date && (
            <p className="text-sm text-gray-600">
              <strong>Marriage Date:</strong> {new Date(formData.marriage_date).toLocaleDateString()}
            </p>
          )}
          {formData.preferred_date && (
            <p className="text-sm text-gray-600">
              <strong>Preferred Date:</strong> {new Date(formData.preferred_date).toLocaleDateString()}
            </p>
          )}
          {formData.preferred_time && (
            <p className="text-sm text-gray-600">
              <strong>Preferred Time:</strong> {
                preferredTimeOptions.find(opt => opt.value === formData.preferred_time)?.label || formData.preferred_time
              }
            </p>
          )}
        </div>

        {/* Form Actions */}
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
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </span>
            ) : (
              isEdit ? 'Update Certificate Form' : 'Create Certificate Form'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CertificateForm;