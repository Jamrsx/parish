import React, { useState, useEffect } from 'react';
import { baptismFormAPI } from '../../../../../library/baptism-form';
import type { CreateBaptismFormData, UpdateBaptismFormData } from '../../../../../library/baptism-form';
import { Plus, X, Edit2, Trash2, Users } from 'lucide-react';

interface BaptismFormProps {
  initialData?: Partial<CreateBaptismFormData>;
  baptismId?: number;
  isEdit?: boolean;
  onSubmit?: (data: CreateBaptismFormData & { godparents?: Godparent[] }) => void;
  onUpdate?: (id: number, data: UpdateBaptismFormData) => void;
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

interface Godparent {
  id?: number;
  godparent_name: string;
  relationship: 'godfather' | 'godmother';
}

interface ApiGodparent {
  godparent_id: number;
  godparent_name: string;
  relationship: 'godfather' | 'godmother';
}

// Time options for dropdown
const timeOptions = [
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

const BaptismForm: React.FC<BaptismFormProps> = ({
  initialData = {},
  baptismId,
  isEdit = false,
  onSubmit,
  onUpdate,
  onCancel,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<CreateBaptismFormData>({
    child_first_name: '',
    child_last_name: '',
    child_middle_name: null,
    child_birth_date: '',
    child_birth_place: null,
    mother_first_name: '',
    mother_last_name: '',
    mother_middle_name: null,
    father_first_name: '',
    father_last_name: '',
    father_middle_name: null,
    address: '',
    contact_number: '',
    preferred_date: '',
    preferred_time: '',
    ...initialData,
  });

  const [godparents, setGodparents] = useState<Godparent[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalData, setModalData] = useState<Godparent>({
    godparent_name: '',
    relationship: 'godfather',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load data if editing
  useEffect(() => {
    if (isEdit && baptismId) {
      loadBaptismData();
    }
  }, [isEdit, baptismId]);

  const loadBaptismData = async () => {
    setIsLoading(true);
    try {
      const response = await baptismFormAPI.getById(baptismId!);
      if (response.data.success) {
        const data = response.data.data;
        setFormData({
          child_first_name: data.child_first_name,
          child_middle_name: data.child_middle_name || null,
          child_last_name: data.child_last_name,
          child_birth_date: data.child_birth_date,
          child_birth_place: data.child_birth_place || null,
          mother_first_name: data.mother_first_name,
          mother_middle_name: data.mother_middle_name || null,
          mother_last_name: data.mother_last_name,
          father_first_name: data.father_first_name,
          father_middle_name: data.father_middle_name || null,
          father_last_name: data.father_last_name,
          address: data.address,
          contact_number: data.contact_number,
          preferred_date: data.preferred_date || '',
          preferred_time: data.preferred_time || '',
        });

        if (data.godparents && data.godparents.length > 0) {
          setGodparents(data.godparents.map((gp: ApiGodparent) => ({
            id: gp.godparent_id,
            godparent_name: gp.godparent_name,
            relationship: gp.relationship,
          })));
        }
      }
    } catch (error) {
      console.error('Error loading baptism data:', error);
      setSubmitError('Failed to load baptism form data');
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
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Open modal for adding new godparent
  const openAddModal = () => {
    setEditingIndex(null);
    setModalData({ godparent_name: '', relationship: 'godfather' });
    setIsModalOpen(true);
  };

  // Open modal for editing existing godparent
  const openEditModal = (index: number) => {
    setEditingIndex(index);
    setModalData({ ...godparents[index] });
    setIsModalOpen(true);
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingIndex(null);
    setModalData({ godparent_name: '', relationship: 'godfather' });
  };

  // Save godparent from modal
  const saveGodparent = () => {
    if (!modalData.godparent_name.trim()) {
      setSubmitError('Godparent name is required');
      return;
    }

    if (editingIndex !== null) {
      const updated = [...godparents];
      updated[editingIndex] = { ...modalData };
      setGodparents(updated);
    } else {
      setGodparents([...godparents, { ...modalData }]);
    }

    setSubmitError(null);
    closeModal();
  };

  // Remove godparent
  const removeGodparent = (index: number) => {
    const updatedGodparents = godparents.filter((_, i) => i !== index);
    setGodparents(updatedGodparents);
    setSubmitError(null);
  };

  // Handle validation for a specific field on blur
  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const requiredFields = [
      'child_first_name',
      'child_last_name',
      'child_birth_date',
      'mother_first_name',
      'mother_last_name',
      'father_first_name',
      'father_last_name',
      'address',
      'contact_number',
      'preferred_date',
      'preferred_time',
    ];
    
    if (!value && requiredFields.includes(name)) {
      const fieldLabels: Record<string, string> = {
        child_first_name: 'Child first name',
        child_last_name: 'Child last name',
        child_birth_date: 'Child birth date',
        mother_first_name: "Mother's first name",
        mother_last_name: "Mother's last name",
        father_first_name: "Father's first name",
        father_last_name: "Father's last name",
        address: 'Address',
        contact_number: 'Contact number',
        preferred_date: 'Preferred date',
        preferred_time: 'Preferred time',
      };
      setErrors((prev) => ({
        ...prev,
        [name]: `${fieldLabels[name]} is required`,
      }));
    }
  };

  const validateGodparents = (): boolean => {
    let isValid = true;
    const newErrors: { [key: string]: string } = { ...errors };

    godparents.forEach((gp, index) => {
      if (!gp.godparent_name.trim()) {
        newErrors[`godparent_${index}`] = 'Godparent name is required';
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.child_first_name?.trim()) {
      newErrors.child_first_name = 'Child first name is required';
    }
    if (!formData.child_last_name?.trim()) {
      newErrors.child_last_name = 'Child last name is required';
    }
    if (!formData.child_birth_date) {
      newErrors.child_birth_date = 'Child birth date is required';
    } else {
      const birthDate = new Date(formData.child_birth_date);
      const today = new Date();
      if (birthDate >= today) {
        newErrors.child_birth_date = 'Birth date must be in the past';
      }
    }
    if (!formData.mother_first_name?.trim()) {
      newErrors.mother_first_name = "Mother's first name is required";
    }
    if (!formData.mother_last_name?.trim()) {
      newErrors.mother_last_name = "Mother's last name is required";
    }
    if (!formData.father_first_name?.trim()) {
      newErrors.father_first_name = "Father's first name is required";
    }
    if (!formData.father_last_name?.trim()) {
      newErrors.father_last_name = "Father's last name is required";
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

    if (!validateGodparents()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && baptismId) {
        const updateData: UpdateBaptismFormData = {
          child_first_name: formData.child_first_name,
          child_middle_name: formData.child_middle_name,
          child_last_name: formData.child_last_name,
          child_birth_date: formData.child_birth_date,
          child_birth_place: formData.child_birth_place,
          mother_first_name: formData.mother_first_name,
          mother_middle_name: formData.mother_middle_name,
          mother_last_name: formData.mother_last_name,
          father_first_name: formData.father_first_name,
          father_middle_name: formData.father_middle_name,
          father_last_name: formData.father_last_name,
          address: formData.address,
          contact_number: formData.contact_number,
          preferred_date: formData.preferred_date,
          preferred_time: formData.preferred_time,
        };

        if (onUpdate) {
          await onUpdate(baptismId, updateData);
        } else {
          await baptismFormAPI.update(baptismId, updateData);
        }
        setSubmitSuccess(true);
      } else {
        if (onSubmit) {
          await onSubmit({
            ...formData,
            godparents: godparents.filter(gp => gp.godparent_name.trim()),
          });
        }
        setSubmitSuccess(true);
        // Reset form
        setFormData({
          child_first_name: '',
          child_last_name: '',
          child_middle_name: null,
          child_birth_date: '',
          child_birth_place: null,
          mother_first_name: '',
          mother_last_name: '',
          mother_middle_name: null,
          father_first_name: '',
          father_last_name: '',
          father_middle_name: null,
          address: '',
          contact_number: '',
          preferred_date: '',
          preferred_time: '',
        });
        setGodparents([]);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: unknown) {
      console.error('Error submitting baptism form:', error);
      const err = error as ErrorResponse;
      setSubmitError(
        err.response?.data?.message || 'Failed to submit baptism form. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setFormData({
      child_first_name: '',
      child_last_name: '',
      child_middle_name: null,
      child_birth_date: '',
      child_birth_place: null,
      mother_first_name: '',
      mother_last_name: '',
      mother_middle_name: null,
      father_first_name: '',
      father_last_name: '',
      father_middle_name: null,
      address: '',
      contact_number: '',
      preferred_date: '',
      preferred_time: '',
    });
    setGodparents([]);
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
          Baptism form {isEdit ? 'updated' : 'created'} successfully!
        </div>
      )}

      {submitError && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Child Information Section */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Child Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                name="child_first_name"
                value={formData.child_first_name || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.child_first_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter child's first name"
              />
              {errors.child_first_name && (
                <p className="mt-1 text-sm text-red-600">{errors.child_first_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Middle Name
              </label>
              <input
                type="text"
                name="child_middle_name"
                value={formData.child_middle_name || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter child's middle name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                name="child_last_name"
                value={formData.child_last_name || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.child_last_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter child's last name"
              />
              {errors.child_last_name && (
                <p className="mt-1 text-sm text-red-600">{errors.child_last_name}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birth Date *
              </label>
              <input
                type="date"
                name="child_birth_date"
                value={formData.child_birth_date || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.child_birth_date ? 'border-red-500' : 'border-gray-300'
                }`}
                max={new Date().toISOString().split('T')[0]}
              />
              {errors.child_birth_date && (
                <p className="mt-1 text-sm text-red-600">{errors.child_birth_date}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birth Place
              </label>
              <input
                type="text"
                name="child_birth_place"
                value={formData.child_birth_place || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter child's birth place"
              />
            </div>
          </div>
        </div>

        {/* Parents Information Section */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Parents Information</h3>

          <h4 className="text-md font-medium text-gray-600 mb-3">Mother</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                name="mother_first_name"
                value={formData.mother_first_name || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.mother_first_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter mother's first name"
              />
              {errors.mother_first_name && (
                <p className="mt-1 text-sm text-red-600">{errors.mother_first_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Middle Name
              </label>
              <input
                type="text"
                name="mother_middle_name"
                value={formData.mother_middle_name || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter mother's middle name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                name="mother_last_name"
                value={formData.mother_last_name || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.mother_last_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter mother's last name"
              />
              {errors.mother_last_name && (
                <p className="mt-1 text-sm text-red-600">{errors.mother_last_name}</p>
              )}
            </div>
          </div>

          <h4 className="text-md font-medium text-gray-600 mb-3">Father</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                name="father_first_name"
                value={formData.father_first_name || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.father_first_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter father's first name"
              />
              {errors.father_first_name && (
                <p className="mt-1 text-sm text-red-600">{errors.father_first_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Middle Name
              </label>
              <input
                type="text"
                name="father_middle_name"
                value={formData.father_middle_name || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter father's middle name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                name="father_last_name"
                value={formData.father_last_name || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.father_last_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter father's last name"
              />
              {errors.father_last_name && (
                <p className="mt-1 text-sm text-red-600">{errors.father_last_name}</p>
              )}
            </div>
          </div>
        </div>

        {/* Preferred Schedule Section */}
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
                {timeOptions.map((option) => (
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
        <div className="border-b border-gray-200 pb-4">
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
        
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">
              Godparents <span className="text-sm font-normal text-gray-400"></span>
            </h3>
            <button
              type="button"
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Godparent
            </button>
          </div>

          {/* Empty State */}
          {godparents.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No godparents added yet </p>
            </div>
          )}

          {/* Godparent List - Side by Side */}
          {godparents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Godfathers Column */}
              <div>
                <p className="text-sm font-medium text-blue-600 mb-2 flex items-center gap-1">
                  <span>👨</span> Godfather
                </p>
                {godparents.filter(gp => gp.relationship === 'godfather').length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No godfather added</p>
                ) : (
                  <div className="space-y-2">
                    {godparents.filter(gp => gp.relationship === 'godfather').map((gp) => {
                      const actualIndex = godparents.indexOf(gp);
                      return (
                        <div
                          key={actualIndex}
                          className="flex items-center justify-between py-2 px-3 bg-blue-50/50 rounded-md hover:bg-blue-100/50 transition-colors border border-blue-100/50"
                        >
                          <span className="text-gray-700 text-sm">{gp.godparent_name}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(actualIndex)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeGodparent(actualIndex)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Godmothers Column */}
              <div>
                <p className="text-sm font-medium text-pink-600 mb-2 flex items-center gap-1">
                  <span>👩</span> Godmother
                </p>
                {godparents.filter(gp => gp.relationship === 'godmother').length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No godmother added</p>
                ) : (
                  <div className="space-y-2">
                    {godparents.filter(gp => gp.relationship === 'godmother').map((gp) => {
                      const actualIndex = godparents.indexOf(gp);
                      return (
                        <div
                          key={actualIndex}
                          className="flex items-center justify-between py-2 px-3 bg-pink-50/50 rounded-md hover:bg-pink-100/50 transition-colors border border-pink-100/50"
                        >
                          <span className="text-gray-700 text-sm">{gp.godparent_name}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(actualIndex)}
                              className="p-1 text-gray-400 hover:text-pink-600 hover:bg-pink-100 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeGodparent(actualIndex)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
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
              isEdit ? 'Update Baptism Form' : 'Create Baptism Form'
            )}
          </button>
        </div>
      </form>

      {/* Modal for Adding/Editing Godparent */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {editingIndex !== null ? 'Edit Godparent' : 'Add Godparent'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={modalData.godparent_name}
                  onChange={(e) => setModalData({ ...modalData, godparent_name: e.target.value })}
                  placeholder="Enter godparent's full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setModalData({ ...modalData, relationship: 'godfather' })}
                    className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-md transition-all ${
                      modalData.relationship === 'godfather'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                        : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    <span className="text-xl">👨</span>
                    Godfather
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalData({ ...modalData, relationship: 'godmother' })}
                    className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-md transition-all ${
                      modalData.relationship === 'godmother'
                        ? 'border-pink-500 bg-pink-50 text-pink-700 ring-2 ring-pink-200'
                        : 'border-gray-300 hover:border-pink-300 hover:bg-pink-50/50'
                    }`}
                  >
                    <span className="text-xl">👩</span>
                    Godmother
                  </button>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveGodparent}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  {editingIndex !== null ? 'Update' : 'Add'} Godparent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BaptismForm;