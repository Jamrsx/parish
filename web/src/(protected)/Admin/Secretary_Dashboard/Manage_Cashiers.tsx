import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  UserPlus,
  Users,
  Mail,
  Lock,
  User as UserIcon,
  CheckCircle2,
  AlertTriangle,
  UserX,
  UserCheck,
  Phone,
  AtSign,
} from 'lucide-react';
import { usersAPI } from '../../../../library/api';
import type { User } from '../../../../library/api';
import PageHeader from './components/PageHeader';
import EmptyState from './components/EmptyState';
import ModalCloseButton from './components/ModalCloseButton';

interface CashierFormData {
  first_name: string;
  middle_name: string;
  last_name: string;
  contact_number: string;
  username: string;
  email: string;
  password: string;
  password_confirmation: string;
}

interface FormErrors {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  contact_number?: string;
  username?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
}

const emptyForm = (): CashierFormData => ({
  first_name: '',
  middle_name: '',
  last_name: '',
  contact_number: '',
  username: '',
  email: '',
  password: '',
  password_confirmation: '',
});

const getCashierDisplayName = (cashier: User): string => {
  if (cashier.full_name) return cashier.full_name;
  if (cashier.first_name) {
    const middle = cashier.middle_name ? ` ${cashier.middle_name}` : '';
    return `${cashier.first_name}${middle} ${cashier.last_name}`.trim();
  }
  return cashier.username || cashier.email || 'Cashier';
};

const isCashierActive = (cashier: User): boolean => cashier.is_active !== false;

const ManageCashiers: React.FC = () => {
  const [cashiers, setCashiers] = useState<User[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<CashierFormData>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    message: string;
    variant: 'success' | 'error';
  }>({ isOpen: false, message: '', variant: 'success' });
  const [disableModal, setDisableModal] = useState<{
    isOpen: boolean;
    cashier: User | null;
    confirmText: string;
  }>({ isOpen: false, cashier: null, confirmText: '' });
  const [disablingId, setDisablingId] = useState<number | null>(null);
  const [enablingId, setEnablingId] = useState<number | null>(null);

  const fetchCashiers = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await usersAPI.listCashiers();
      console.log('Cashiers list response:', response.data);

      if (response.data?.success) {
        const data = response.data.data;
        if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
          setCashiers(data.data);
        } else if (Array.isArray(data)) {
          setCashiers(data);
        } else {
          setCashiers([]);
        }
      } else {
        setCashiers([]);
      }
    } catch (error) {
      console.error('Failed to load cashiers:', error);
      setCashiers([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchCashiers();
  }, [fetchCashiers]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required.';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required.';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required.';
    } else if (!/^[a-zA-Z0-9._-]{3,50}$/.test(formData.username.trim())) {
      newErrors.username = 'Username must be 3–50 characters (letters, numbers, . _ -).';
    }

    if (formData.contact_number) {
      const phoneRegex = /^09\d{9}$/;
      if (!phoneRegex.test(formData.contact_number)) {
        newErrors.contact_number = 'Enter 11-digit PH number (e.g., 09123456789).';
      }
    }

    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Enter a valid email address.';
      }
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }

    if (formData.password !== formData.password_confirmation) {
      newErrors.password_confirmation = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof CashierFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleContactNumberChange = (text: string) => {
    const digitsOnly = text.replace(/\D/g, '').slice(0, 11);
    console.log('Cashier contact number input:', digitsOnly);
    handleChange('contact_number', digitsOnly);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const response = await usersAPI.createCashier({
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim() || null,
        last_name: formData.last_name.trim(),
        username: formData.username.trim(),
        email: formData.email.trim() || null,
        contact_number: formData.contact_number.trim() || null,
        password: formData.password,
      });

      console.log('Create cashier response:', response.data);

      if (response.data?.success) {
        setAlertModal({
          isOpen: true,
          message: 'Cashier account created successfully. They can log in with the username and password.',
          variant: 'success',
        });
        setFormData(emptyForm());
        await fetchCashiers();
      }
    } catch (error) {
      console.error('Create cashier error:', error);

      if (axios.isAxiosError(error) && error.response?.data?.errors) {
        const apiErrors = error.response.data.errors as Record<string, string[]>;
        setErrors({
          first_name: apiErrors.first_name?.[0],
          middle_name: apiErrors.middle_name?.[0],
          last_name: apiErrors.last_name?.[0],
          contact_number: apiErrors.contact_number?.[0],
          username: apiErrors.username?.[0],
          email: apiErrors.email?.[0],
          password: apiErrors.password?.[0],
        });
      }

      setAlertModal({
        isOpen: true,
        message: axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to create cashier account.'
          : 'Failed to create cashier account.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openDisableModal = (cashier: User) => {
    console.log('Open disable cashier modal:', cashier.user_id);
    setDisableModal({ isOpen: true, cashier, confirmText: '' });
  };

  const closeDisableModal = () => {
    setDisableModal({ isOpen: false, cashier: null, confirmText: '' });
  };

  const handleDisableCashier = async () => {
    if (!disableModal.cashier) return;
    if (disableModal.confirmText !== 'Disable') {
      setAlertModal({
        isOpen: true,
        message: 'Please type "Disable" exactly to confirm.',
        variant: 'error',
      });
      return;
    }

    const cashierId = disableModal.cashier.user_id;
    setDisablingId(cashierId);
    try {
      const response = await usersAPI.disableCashier(cashierId);
      console.log('Disable cashier response:', response.data);
      setAlertModal({
        isOpen: true,
        message: 'Cashier account disabled. They can no longer log in to the cashier portal.',
        variant: 'success',
      });
      closeDisableModal();
      await fetchCashiers();
    } catch (error) {
      console.error('Disable cashier error:', error);
      setAlertModal({
        isOpen: true,
        message: axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to disable cashier account.'
          : 'Failed to disable cashier account.',
        variant: 'error',
      });
    } finally {
      setDisablingId(null);
    }
  };

  const handleEnableCashier = async (cashier: User) => {
    setEnablingId(cashier.user_id);
    try {
      const response = await usersAPI.enableCashier(cashier.user_id);
      console.log('Enable cashier response:', response.data);
      setAlertModal({
        isOpen: true,
        message: 'Cashier account enabled. They can log in again.',
        variant: 'success',
      });
      await fetchCashiers();
    } catch (error) {
      console.error('Enable cashier error:', error);
      setAlertModal({
        isOpen: true,
        message: axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to enable cashier account.'
          : 'Failed to enable cashier account.',
        variant: 'error',
      });
    } finally {
      setEnablingId(null);
    }
  };

  const activeCashierCount = cashiers.filter(isCashierActive).length;

  return (
    <div>
      <PageHeader
        icon={UserPlus}
        title="Manage Cashiers"
        description="Create cashier accounts for the Cashier Portal and disable accounts when needed."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Add New Cashier</h2>
            <p className="text-sm text-slate-500 mb-6">
              Cashiers log in with username and password on the web portal.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name *</label>
                <div className="relative">
                  <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => handleChange('first_name', e.target.value)}
                    placeholder="e.g. Ana"
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.first_name ? 'border-red-300' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.first_name && <p className="text-xs text-red-600 mt-1">{errors.first_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Middle Name</label>
                <input
                  type="text"
                  value={formData.middle_name}
                  onChange={(e) => handleChange('middle_name', e.target.value)}
                  placeholder="e.g. L."
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.middle_name ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name *</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  placeholder="e.g. Santos"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.last_name ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {errors.last_name && <p className="text-xs text-red-600 mt-1">{errors.last_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Username *</label>
                <div className="relative">
                  <AtSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleChange('username', e.target.value)}
                    placeholder="e.g. cashier2"
                    autoComplete="off"
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.username ? 'border-red-300' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.username && <p className="text-xs text-red-600 mt-1">{errors.username}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Contact Number</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
                <p className="text-xs text-slate-400 mt-1">{formData.contact_number.length}/11 digits</p>
                {errors.contact_number && (
                  <p className="text-xs text-red-600 mt-1">{errors.contact_number}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email (optional)</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="cashier@gmail.com"
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.email ? 'border-red-300' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password *</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder="Minimum 8 characters"
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.password ? 'border-red-300' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password *</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={formData.password_confirmation}
                    onChange={(e) => handleChange('password_confirmation', e.target.value)}
                    placeholder="Re-enter password"
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.password_confirmation ? 'border-red-300' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.password_confirmation && (
                  <p className="text-xs text-red-600 mt-1">{errors.password_confirmation}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Add Cashier
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-800">Registered Cashiers</h2>
              </div>
              <span className="text-sm text-slate-500">
                {activeCashierCount} active / {cashiers.length} total
              </span>
            </div>

            {loadingList ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              </div>
            ) : cashiers.length === 0 ? (
              <EmptyState
                title="No cashiers yet"
                description="Add a cashier account using the form. They will appear here and can use the Cashier Portal."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {cashiers.map((cashier) => {
                  const active = isCashierActive(cashier);
                  return (
                    <div
                      key={cashier.user_id}
                      className={`px-6 py-4 flex items-center gap-4 transition-colors ${
                        active ? 'hover:bg-blue-50/50' : 'bg-slate-50/80 opacity-75'
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold text-sm ${
                          active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {getCashierDisplayName(cashier).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">
                          {getCashierDisplayName(cashier)}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                          @{cashier.username || 'no-username'}
                        </p>
                        {cashier.email && (
                          <p className="text-xs text-slate-400 truncate">{cashier.email}</p>
                        )}
                        {cashier.contact_number && (
                          <p className="text-xs text-slate-400 truncate">{cashier.contact_number}</p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {active ? 'Active' : 'Disabled'}
                      </span>
                      {active ? (
                        <button
                          type="button"
                          onClick={() => openDisableModal(cashier)}
                          disabled={disablingId === cashier.user_id}
                          className="shrink-0 px-3 py-1.5 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          <UserX size={14} />
                          Disable
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleEnableCashier(cashier)}
                          disabled={enablingId === cashier.user_id}
                          className="shrink-0 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          <UserCheck size={14} />
                          {enablingId === cashier.user_id ? 'Enabling...' : 'Enable'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
            Disabled cashiers are logged out and cannot sign in to the Cashier Portal until re-enabled.
          </div>
        </div>
      </div>

      {disableModal.isOpen && disableModal.cashier && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Disable Cashier Account</h3>
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
                    <strong>{getCashierDisplayName(disableModal.cashier)}</strong>
                    {disableModal.cashier.username ? ` (@${disableModal.cashier.username})` : ''}.
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    They will be logged out and cannot sign in until you enable the account again.
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
                onClick={handleDisableCashier}
                disabled={
                  disablingId === disableModal.cashier.user_id ||
                  disableModal.confirmText !== 'Disable'
                }
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {disablingId === disableModal.cashier.user_id ? 'Disabling...' : 'Disable Account'}
              </button>
            </div>
          </div>
        </div>
      )}

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

export default ManageCashiers;
