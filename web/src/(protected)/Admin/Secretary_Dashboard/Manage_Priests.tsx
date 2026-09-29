import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { UserPlus, Users, Mail, Lock, User as UserIcon, CheckCircle2, AlertTriangle, UserX, UserCheck, Phone, Pencil, Save } from 'lucide-react';
import { usersAPI } from '../../../../library/api';
import type { User } from '../../../../library/api';
import PageHeader from './components/PageHeader';
import EmptyState from './components/EmptyState';
import ModalCloseButton from './components/ModalCloseButton';
import { SecretaryPersonListSkeleton } from './components/SecretarySkeletons';

interface PriestFormData {
  first_name: string;
  middle_name: string;
  last_name: string;
  contact_number: string;
  email: string;
  password: string;
  password_confirmation: string;
  is_resident: boolean;
}

interface FormErrors {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  contact_number?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
}

const getPriestDisplayName = (priest: User): string => {
  if (priest.full_name) return priest.full_name;
  if (priest.first_name) {
    const middle = priest.middle_name ? ` ${priest.middle_name}` : '';
    return `${priest.first_name}${middle} ${priest.last_name}`.trim();
  }
  return priest.email || 'Priest';
};

const isPriestActive = (priest: User): boolean => priest.is_active !== false;

const emptyPriestForm = (): PriestFormData => ({
  first_name: '',
  middle_name: '',
  last_name: '',
  contact_number: '',
  email: '',
  password: '',
  password_confirmation: '',
  is_resident: true,
});

const priestToForm = (priest: User): PriestFormData => ({
  first_name: priest.first_name || '',
  middle_name: priest.middle_name || '',
  last_name: priest.last_name || '',
  contact_number: priest.contact_number || '',
  email: priest.email || '',
  password: '',
  password_confirmation: '',
  is_resident: priest.is_resident !== false,
});

const ManagePriests: React.FC = () => {
  const [priests, setPriests] = useState<User[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<PriestFormData>(emptyPriestForm());
  const [editingPriest, setEditingPriest] = useState<User | null>(null);
  const formCardRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    message: string;
    variant: 'success' | 'error';
  }>({ isOpen: false, message: '', variant: 'success' });
  const [disableModal, setDisableModal] = useState<{
    isOpen: boolean;
    priest: User | null;
    confirmText: string;
  }>({ isOpen: false, priest: null, confirmText: '' });
  const [disablingId, setDisablingId] = useState<number | null>(null);
  const [enablingId, setEnablingId] = useState<number | null>(null);

  const fetchPriests = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await usersAPI.listPriests();
      console.log('Priests list response:', response.data);

      if (response.data?.success) {
        const data = response.data.data;
        if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
          setPriests(data.data);
        } else if (Array.isArray(data)) {
          setPriests(data);
        } else {
          setPriests([]);
        }
      } else {
        setPriests([]);
      }
    } catch (error) {
      console.error('Failed to load priests:', error);
      setPriests([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchPriests();
  }, [fetchPriests]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required.';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required.';
    }

    if (formData.contact_number) {
      const phoneRegex = /^09\d{9}$/;
      if (!phoneRegex.test(formData.contact_number)) {
        newErrors.contact_number = 'Enter 11-digit PH number (e.g., 09123456789).';
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Enter a valid email address.';
    }

    const passwordRequired = !editingPriest;
    if (!formData.password) {
      if (passwordRequired) newErrors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }

    if ((formData.password || passwordRequired) && formData.password !== formData.password_confirmation) {
      newErrors.password_confirmation = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const hasEditChanges = (() => {
    if (!editingPriest) return true;
    const original = priestToForm(editingPriest);
    return (
      formData.first_name.trim() !== original.first_name.trim() ||
      formData.middle_name.trim() !== original.middle_name.trim() ||
      formData.last_name.trim() !== original.last_name.trim() ||
      formData.contact_number.trim() !== original.contact_number.trim() ||
      formData.email.trim() !== original.email.trim() ||
      formData.is_resident !== original.is_resident ||
      formData.password !== ''
    );
  })();

  const startEdit = (priest: User) => {
    console.log('[ManagePriests] Start edit:', priest.user_id);
    setEditingPriest(priest);
    setFormData(priestToForm(priest));
    setErrors({});
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancelEdit = () => {
    console.log('[ManagePriests] Cancel edit');
    setEditingPriest(null);
    setFormData(emptyPriestForm());
    setErrors({});
  };

  const applyApiErrors = (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.data?.errors) {
      const apiErrors = error.response.data.errors as Record<string, string[]>;
      setErrors({
        first_name: apiErrors.first_name?.[0],
        middle_name: apiErrors.middle_name?.[0],
        last_name: apiErrors.last_name?.[0],
        contact_number: apiErrors.contact_number?.[0],
        email: apiErrors.email?.[0],
        password: apiErrors.password?.[0],
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingPriest) return;
    const payload = {
      first_name: formData.first_name.trim(),
      middle_name: formData.middle_name.trim() || null,
      last_name: formData.last_name.trim(),
      contact_number: formData.contact_number.trim() || null,
      email: formData.email.trim(),
      is_resident: formData.is_resident ? 1 : 0,
    };
    console.log('[ManagePriests] Update payload:', editingPriest.user_id, {
      ...payload,
      password_changed: !!formData.password,
    });

    setSubmitting(true);
    try {
      const response = await usersAPI.updatePriest(editingPriest.user_id, {
        ...payload,
        ...(formData.password
          ? { password: formData.password, password_confirmation: formData.password_confirmation }
          : {}),
      });
      console.log('[ManagePriests] Update response:', response.data);
      if (response.data?.success) {
        setAlertModal({
          isOpen: true,
          message: response.data.message || 'Priest account updated successfully.',
          variant: 'success',
        });
        setEditingPriest(null);
        setFormData(emptyPriestForm());
        await fetchPriests();
      }
    } catch (error) {
      console.error('[ManagePriests] Update error:', error);
      applyApiErrors(error);
      setAlertModal({
        isOpen: true,
        message: axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to update priest account.'
          : 'Failed to update priest account.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof FormErrors, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleContactNumberChange = (text: string) => {
    const digitsOnly = text.replace(/\D/g, '').slice(0, 11);
    console.log('Priest contact number input:', digitsOnly);
    handleChange('contact_number', digitsOnly);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (editingPriest) {
      await handleUpdate();
      return;
    }

    setSubmitting(true);

    try {
      const response = await usersAPI.createPriest({
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim() || null,
        last_name: formData.last_name.trim(),
        contact_number: formData.contact_number.trim() || null,
        email: formData.email.trim(),
        password: formData.password,
        is_resident: formData.is_resident ? 1 : 0,
      });

      console.log('Create priest response:', response.data);

      if (response.data?.success) {
        setAlertModal({
          isOpen: true,
          message: 'Priest account created successfully. They can now be assigned to service requests.',
          variant: 'success',
        });
        setFormData(emptyPriestForm());
        await fetchPriests();
      }
    } catch (error) {
      console.error('Create priest error:', error);
      applyApiErrors(error);

      setAlertModal({
        isOpen: true,
        message:
          axios.isAxiosError(error)
            ? error.response?.data?.message || 'Failed to create priest account.'
            : 'Failed to create priest account.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openDisableModal = (priest: User) => {
    console.log('Open disable priest modal:', priest.user_id);
    setDisableModal({ isOpen: true, priest, confirmText: '' });
  };

  const closeDisableModal = () => {
    setDisableModal({ isOpen: false, priest: null, confirmText: '' });
  };

  const handleDisablePriest = async () => {
    if (!disableModal.priest) return;
    if (disableModal.confirmText !== 'Disable') {
      setAlertModal({
        isOpen: true,
        message: 'Please type "Disable" exactly to confirm.',
        variant: 'error',
      });
      return;
    }

    const priestId = disableModal.priest.user_id;
    setDisablingId(priestId);
    try {
      const response = await usersAPI.disablePriest(priestId);
      console.log('Disable priest response:', response.data);
      setAlertModal({
        isOpen: true,
        message: 'Priest account disabled. They can no longer log in or be assigned to requests.',
        variant: 'success',
      });
      closeDisableModal();
      await fetchPriests();
    } catch (error) {
      console.error('Disable priest error:', error);
      setAlertModal({
        isOpen: true,
        message:
          axios.isAxiosError(error)
            ? error.response?.data?.message || 'Failed to disable priest account.'
            : 'Failed to disable priest account.',
        variant: 'error',
      });
    } finally {
      setDisablingId(null);
    }
  };

  const handleEnablePriest = async (priest: User) => {
    setEnablingId(priest.user_id);
    try {
      const response = await usersAPI.enablePriest(priest.user_id);
      console.log('Enable priest response:', response.data);
      setAlertModal({
        isOpen: true,
        message: 'Priest account enabled. They can log in and be assigned again.',
        variant: 'success',
      });
      await fetchPriests();
    } catch (error) {
      console.error('Enable priest error:', error);
      setAlertModal({
        isOpen: true,
        message:
          axios.isAxiosError(error)
            ? error.response?.data?.message || 'Failed to enable priest account.'
            : 'Failed to enable priest account.',
        variant: 'error',
      });
    } finally {
      setEnablingId(null);
    }
  };

  const activePriestCount = priests.filter(isPriestActive).length;

  return (
    <div>
      <PageHeader
        icon={UserPlus}
        title="Manage Priests"
        description="Add priest accounts so they can be assigned when approving service requests."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Add Priest Form */}
        <div className="lg:col-span-2">
          <div
            ref={formCardRef}
            className={`bg-white rounded-xl border shadow-sm p-6 scroll-mt-4 ${
              editingPriest ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <h2 className="text-lg font-semibold text-slate-800 mb-1">
              {editingPriest ? 'Edit Priest' : 'Add New Priest'}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {editingPriest
                ? 'Update the details below. Leave the password blank to keep the current one.'
                : 'The priest will use this email and password to log in to the web portal.'}
            </p>
            {editingPriest ? (
              <div className="mb-5 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <Pencil size={14} className="shrink-0" />
                <span className="truncate">
                  Editing: <strong>{getPriestDisplayName(editingPriest)}</strong>
                </span>
              </div>
            ) : (
              <div className="mb-2" />
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  First Name *
                </label>
                <div className="relative">
                  <UserIcon
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => handleChange('first_name', e.target.value)}
                    placeholder="e.g. Juan"
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.first_name ? 'border-red-300' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.first_name && (
                  <p className="text-xs text-red-600 mt-1">{errors.first_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Middle Name
                </label>
                <input
                  type="text"
                  value={formData.middle_name}
                  onChange={(e) => handleChange('middle_name', e.target.value)}
                  placeholder="e.g. P."
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.middle_name ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {errors.middle_name && (
                  <p className="text-xs text-red-600 mt-1">{errors.middle_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  placeholder="e.g. Dela Cruz"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.last_name ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {errors.last_name && (
                  <p className="text-xs text-red-600 mt-1">{errors.last_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Contact Number
                </label>
                <div className="relative">
                  <Phone
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    value={formData.contact_number}
                    onChange={(e) => handleContactNumberChange(e.target.value)}
                    placeholder="09123456789"
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.contact_number ? 'border-red-300' : 'border-slate-200'
                    }`}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {formData.contact_number.length}/11 digits
                </p>
                {errors.contact_number && (
                  <p className="text-xs text-red-600 mt-1">{errors.contact_number}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Residency *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Priest residency: resident');
                      setFormData((prev) => ({ ...prev, is_resident: true }));
                    }}
                    className={`px-4 py-3 rounded-lg border text-sm font-medium text-left ${
                      formData.is_resident
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    Resident
                    <span className="block text-xs font-normal text-slate-500 mt-0.5">
                      Lives in the parish
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Priest residency: non-resident');
                      setFormData((prev) => ({ ...prev, is_resident: false }));
                    }}
                    className={`px-4 py-3 rounded-lg border text-sm font-medium text-left ${
                      !formData.is_resident
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    Non-resident
                    <span className="block text-xs font-normal text-slate-500 mt-0.5">
                      Lives outside the parish
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Gmail / Email *
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="priest@gmail.com"
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.email ? 'border-red-300' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {editingPriest ? (
                    <>New Password <span className="font-normal text-slate-400">(optional)</span></>
                  ) : (
                    'Password *'
                  )}
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder={editingPriest ? 'Leave blank to keep current password' : 'Minimum 8 characters'}
                    autoComplete="new-password"
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.password ? 'border-red-300' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600 mt-1">{errors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {editingPriest ? 'Confirm New Password' : 'Confirm Password *'}
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="password"
                    value={formData.password_confirmation}
                    onChange={(e) => handleChange('password_confirmation', e.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    disabled={!!editingPriest && !formData.password}
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.password_confirmation ? 'border-red-300' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.password_confirmation && (
                  <p className="text-xs text-red-600 mt-1">{errors.password_confirmation}</p>
                )}
              </div>

              <div className={editingPriest ? 'grid grid-cols-2 gap-3' : ''}>
                {editingPriest && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={submitting}
                    className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    Cancel edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting || !hasEditChanges}
                  title={!hasEditChanges ? 'No changes to save yet' : undefined}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      {editingPriest ? 'Saving...' : 'Creating...'}
                    </>
                  ) : editingPriest ? (
                    <>
                      <Save size={16} />
                      Save changes
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Add Priest
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Priest List */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-800">Registered Priests</h2>
              </div>
              <span className="text-sm text-slate-500">
                {loadingList ? ' ' : `${activePriestCount} active / ${priests.length} total`}
              </span>
            </div>

            {loadingList && priests.length === 0 ? (
              <SecretaryPersonListSkeleton rows={6} />
            ) : priests.length === 0 ? (
              <EmptyState
                title="No priests yet"
                description="Add a priest account using the form. They will appear here and can be assigned to requests."
              />
            ) : (
              <div className={`divide-y divide-slate-100 ${loadingList ? 'opacity-80' : ''}`}>
                {priests.map((priest) => {
                  const active = isPriestActive(priest);
                  const isEditing = editingPriest?.user_id === priest.user_id;
                  return (
                  <div
                    key={priest.user_id}
                    className={`px-6 py-4 flex flex-wrap sm:flex-nowrap items-center gap-4 transition-colors ${
                      isEditing
                        ? 'bg-blue-50 border-l-4 border-blue-500'
                        : active
                          ? 'hover:bg-blue-50/50'
                          : 'bg-slate-50/80 opacity-75'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold text-sm ${
                        active
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {getPriestDisplayName(priest).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">
                        {getPriestDisplayName(priest)}
                      </p>
                      <p className="text-sm text-slate-500 truncate">{priest.email || 'No email'}</p>
                      {priest.contact_number && (
                        <p className="text-xs text-slate-400 truncate">{priest.contact_number}</p>
                      )}
                      <span
                        className={`inline-flex mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          priest.is_resident === false
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {priest.is_resident === false ? 'Non-resident' : 'Resident'}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        active
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {active ? 'Active' : 'Disabled'}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(priest)}
                      disabled={isEditing}
                      aria-label={`Edit ${getPriestDisplayName(priest)}`}
                      className="shrink-0 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-60 flex items-center gap-1"
                    >
                      <Pencil size={14} />
                      {isEditing ? 'Editing' : 'Edit'}
                    </button>
                    {active ? (
                      <button
                        type="button"
                        onClick={() => openDisableModal(priest)}
                        disabled={disablingId === priest.user_id}
                        className="shrink-0 px-3 py-1.5 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <UserX size={14} />
                        Disable
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEnablePriest(priest)}
                        disabled={enablingId === priest.user_id}
                        className="shrink-0 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <UserCheck size={14} />
                        {enablingId === priest.user_id ? 'Enabling...' : 'Enable'}
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
            Only <strong>active</strong> priests appear when assigning a priest in Manage Requests or
            Service Records. Disabled priests cannot log in.
          </div>
        </div>
      </div>

      {/* Disable Confirmation Modal */}
      {disableModal.isOpen && disableModal.priest && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Disable Priest Account</h3>
              <ModalCloseButton onClick={closeDisableModal} />
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 p-2 rounded-full bg-rose-100 text-rose-600">
                  <AlertTriangle size={22} />
                </span>
                <div>
                  <p className="text-slate-700">
                    You are about to disable{' '}
                    <strong>{getPriestDisplayName(disableModal.priest)}</strong>.
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    They will be logged out, cannot sign in, and will not appear in priest assignment
                    lists.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Type <span className="font-bold text-rose-600">Disable</span> to confirm
                </label>
                <input
                  type="text"
                  value={disableModal.confirmText}
                  onChange={(e) =>
                    setDisableModal((prev) => ({ ...prev, confirmText: e.target.value }))
                  }
                  placeholder="Disable"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={closeDisableModal}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDisablePriest}
                disabled={
                  disablingId === disableModal.priest.user_id ||
                  disableModal.confirmText !== 'Disable'
                }
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {disablingId === disableModal.priest.user_id ? 'Disabling...' : 'Disable Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">
                {alertModal.variant === 'success' ? 'Success' : 'Error'}
              </h3>
              <ModalCloseButton onClick={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))} />
            </div>
            <div className="p-4 flex items-start gap-3">
              <span
                className={`flex-shrink-0 p-2 rounded-full ${
                  alertModal.variant === 'success'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-rose-100 text-rose-600'
                }`}
              >
                {alertModal.variant === 'success' ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <AlertTriangle size={22} />
                )}
              </span>
              <p className="text-slate-600">{alertModal.message}</p>
            </div>
            <div className="flex justify-end p-4 border-t border-slate-200">
              <button
                onClick={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${
                  alertModal.variant === 'success'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagePriests;
