import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eraser, Loader2, PenLine, Plus, Printer, RefreshCw, Trash2, UserSearch } from 'lucide-react';
import { usersAPI } from '../../../../../library/api';
import type { User } from '../../../../../library/AuthStorage';
import {
  certificatesAPI,
  type BaptismRecordOption,
  type BaptismalCertificateDetails,
  type CertificateRequestOption,
} from '../../../../../library/certificates';
import BaptismalCertificateSheet, { SHEET_HEIGHT_IN, SHEET_WIDTH_IN } from './BaptismalCertificateSheet';
import SourcePicker, { type SourceTab } from './SourcePicker';
import PriestPicker from './PriestPicker';
import { priestInitials, todayYmd, withPriestTitle } from './certificateFormat';

const SIGNATORY_STORAGE_KEY = 'certificates.signatoryPriestId';
const SIGNATORY_USAGE_KEY = 'certificates.signatoryUsage';
const SIGNATORY_NAMES_KEY = 'certificates.signatoryNames';
const PURPOSE_PRESETS = ['Reference', 'Marriage', 'School', 'Confirmation'];

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** The priest who signed the most certificates on this computer, else the last one picked. */
const readDefaultSignatoryId = (): string | null => {
  const usage = readJson<Record<string, number>>(SIGNATORY_USAGE_KEY, {});
  const top = Object.entries(usage).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : localStorage.getItem(SIGNATORY_STORAGE_KEY);
};
const MAX_SPONSORS = 8;
const PX_PER_IN = 96;

type FormState = {
  person_name: string;
  father_name: string;
  mother_name: string;
  birth_place: string;
  birth_date: string;
  baptism_date: string;
  minister_name: string;
  sponsors: string[];
  register_no: string;
  register_page: string;
  register_line: string;
  purpose: string;
  date_issued: string;
  signatory_priest_id: string;
  signatory_name: string;
};

type Source = {
  key: string;
  baptism_id: number | null;
  request_id: number | null;
  request_status: string | null;
  label: string;
  hint: string;
};

type IssuedNotice = {
  person_name: string;
  request_id: number | null;
  request_status: string | null;
  completed: boolean;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

interface GenerateCertificateProps {
  onPrint: (details: BaptismalCertificateDetails) => void;
  onAlert: (type: 'success' | 'error', message: string) => void;
  onIssued: () => void;
}

const inputClass =
  'w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const fieldClass = (error?: string) => `${inputClass} ${error ? 'border-red-400 bg-red-50/40' : 'border-slate-200'}`;

const blankForm = (keep?: Partial<FormState>): FormState => ({
  person_name: '',
  father_name: '',
  mother_name: '',
  birth_place: '',
  birth_date: '',
  baptism_date: '',
  minister_name: '',
  sponsors: ['', ''],
  register_no: '',
  register_page: '',
  register_line: '',
  purpose: keep?.purpose || 'Reference',
  date_issued: keep?.date_issued || todayYmd(),
  signatory_priest_id: keep?.signatory_priest_id || '',
  signatory_name: keep?.signatory_name || '',
});

const sponsorRows = (list: string[]) => (list.length > 0 ? [...list] : ['', '']);

const toDetails = (form: FormState): BaptismalCertificateDetails => ({
  person_name: form.person_name.trim(),
  father_name: form.father_name.trim() || null,
  mother_name: form.mother_name.trim() || null,
  birth_date: form.birth_date,
  birth_place: form.birth_place.trim() || null,
  baptism_date: form.baptism_date,
  minister_name: form.minister_name.trim(),
  sponsors: form.sponsors.map((s) => s.trim()).filter(Boolean),
  register_no: form.register_no.trim() || null,
  register_page: form.register_page.trim() || null,
  register_line: form.register_line.trim() || null,
  purpose: form.purpose.trim() || null,
  date_issued: form.date_issued,
  signatory_name: form.signatory_name.trim(),
});

const validate = (form: FormState): FieldErrors => {
  const errors: FieldErrors = {};
  const today = todayYmd();
  if (!form.person_name.trim()) errors.person_name = 'Enter the name of the baptized person.';
  if (!form.birth_date) errors.birth_date = 'Enter the date of birth.';
  else if (form.birth_date > today) errors.birth_date = 'Date of birth cannot be in the future.';
  if (!form.baptism_date) errors.baptism_date = 'Enter the baptism date.';
  else if (form.baptism_date > today) errors.baptism_date = 'This baptism has not happened yet.';
  else if (form.birth_date && form.baptism_date < form.birth_date)
    errors.baptism_date = 'Baptism date cannot be before the date of birth.';
  if (!form.minister_name.trim()) errors.minister_name = 'Enter the priest who baptized.';
  if (!form.date_issued) errors.date_issued = 'Enter the date issued.';
  if (!form.signatory_name.trim()) errors.signatory_name = 'Choose or type the signing priest.';
  return errors;
};

const Field: React.FC<{ label: string; htmlFor: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }> = ({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}) => (
  <div>
    <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error ? (
      <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>
    ) : hint ? (
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    ) : null}
  </div>
);

const GenerateCertificate: React.FC<GenerateCertificateProps> = ({ onPrint, onAlert, onIssued }) => {
  const [tab, setTab] = useState<SourceTab>('records');
  const [source, setSource] = useState<Source | null>(null);
  const [form, setForm] = useState<FormState>(() => blankForm());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [priests, setPriests] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [notice, setNotice] = useState<IssuedNotice | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [signatoryNames, setSignatoryNames] = useState<Record<string, string>>(() => readJson(SIGNATORY_NAMES_KEY, {}));
  const [defaultSignatoryId, setDefaultSignatoryId] = useState<string | null>(() => readDefaultSignatoryId());
  const [changingSignatory, setChangingSignatory] = useState(false);
  const [editingPrintedName, setEditingPrintedName] = useState(false);
  const [printedNameDraft, setPrintedNameDraft] = useState('');

  const previewBoxRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.55);

  useEffect(() => {
    let cancelled = false;
    usersAPI
      .listPriests({ activeOnly: true })
      .then((res) => {
        if (cancelled) return;
        const list = res.data.data?.data || [];
        console.log('[Certificates] Priests loaded', list.length);
        setPriests(list);
        const savedId = readDefaultSignatoryId();
        const saved = list.find((p) => String(p.user_id) === savedId);
        if (saved) {
          const names = readJson<Record<string, string>>(SIGNATORY_NAMES_KEY, {});
          setForm((f) =>
            f.signatory_name
              ? f
              : { ...f, signatory_priest_id: String(saved.user_id), signatory_name: names[saved.user_id] || withPriestTitle(saved.full_name) },
          );
        }
      })
      .catch((err) => console.error('[Certificates] Failed to load priests', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    // Fit the sheet to the column width, but keep it short enough to stay fully visible while sticky.
    const fit = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      const byWidth = width / (SHEET_WIDTH_IN * PX_PER_IN);
      const byHeight = Math.max(0.4, (window.innerHeight - 170) / (SHEET_HEIGHT_IN * PX_PER_IN));
      setPreviewScale(Math.min(1, byWidth, byHeight));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    window.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickerOpen]);

  const keepFromForm = (): Partial<FormState> => ({
    purpose: form.purpose,
    date_issued: form.date_issued,
    signatory_priest_id: form.signatory_priest_id,
    signatory_name: form.signatory_name,
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const pickRecord = (r: BaptismRecordOption) => {
    console.log('[Certificates] Picked baptism record', r);
    setForm({
      ...blankForm(keepFromForm()),
      person_name: r.person_name || '',
      father_name: r.father_name || '',
      mother_name: r.mother_name || '',
      birth_place: r.birth_place || '',
      birth_date: r.birth_date || '',
      baptism_date: r.baptism_date || '',
      minister_name: withPriestTitle(r.minister_name),
      sponsors: sponsorRows(r.sponsors),
      register_no: r.register_no || '',
      register_page: r.register_page || '',
      register_line: r.register_line || '',
    });
    setSource({
      key: `record-${r.baptism_id}`,
      baptism_id: r.baptism_id,
      request_id: null,
      request_status: null,
      label: r.person_name || 'Baptism record',
      hint: `Baptism record · ${r.status === 'done' ? 'Completed' : 'Approved'}`,
    });
    setErrors({});
    setNotice(null);
    setPickerOpen(false);
  };

  const pickRequest = (r: CertificateRequestOption) => {
    console.log('[Certificates] Picked certificate request', r);
    const m = r.matched_record;
    setForm({
      ...blankForm(keepFromForm()),
      person_name: r.person_name || m?.person_name || '',
      father_name: r.father_name || m?.father_name || '',
      mother_name: r.mother_name || m?.mother_name || '',
      birth_place: r.birth_place || m?.birth_place || '',
      birth_date: r.birth_date || m?.birth_date || '',
      baptism_date: m?.baptism_date || r.baptism_date || '',
      minister_name: withPriestTitle(m?.minister_name),
      sponsors: sponsorRows(m?.sponsors || []),
      register_no: m?.register_no || '',
      register_page: m?.register_page || '',
      register_line: m?.register_line || '',
    });
    setSource({
      key: `request-${r.request_id}`,
      baptism_id: m?.baptism_id ?? null,
      request_id: r.request_id,
      request_status: r.status,
      label: r.person_name || m?.person_name || `Request #${r.request_id}`,
      hint: `Request #${r.request_id} · ${m ? 'Matched to a baptism record' : 'No baptism record matched — check the paper register'}`,
    });
    setErrors({});
    setNotice(null);
    setPickerOpen(false);
  };

  const startManual = () => {
    console.log('[Certificates] Manual entry started');
    setForm(blankForm(keepFromForm()));
    setSource({
      key: 'manual',
      baptism_id: null,
      request_id: null,
      request_status: null,
      label: 'Manual entry',
      hint: 'Type the details exactly as written in the Baptismal Register',
    });
    setErrors({});
    setNotice(null);
    setPickerOpen(false);
  };

  const clearForm = () => {
    setForm(blankForm(keepFromForm()));
    setSource(null);
    setErrors({});
    setNotice(null);
  };

  const signatoryDisplayName = useCallback(
    (p: User) => signatoryNames[p.user_id] || withPriestTitle(p.full_name),
    [signatoryNames],
  );
  const ministerDisplayName = useCallback((p: User) => withPriestTitle(p.full_name), []);

  const chooseSignatory = (name: string, priest: User | null) => {
    const priestId = priest ? String(priest.user_id) : '';
    if (priestId) localStorage.setItem(SIGNATORY_STORAGE_KEY, priestId);
    setForm((f) => ({ ...f, signatory_priest_id: priestId, signatory_name: name }));
    setErrors((e) => ({ ...e, signatory_name: undefined }));
    setChangingSignatory(false);
    setEditingPrintedName(false);
  };

  const startEditPrintedName = () => {
    setPrintedNameDraft(form.signatory_name);
    setEditingPrintedName(true);
  };

  const savePrintedName = () => {
    const name = printedNameDraft.trim();
    if (!name) {
      onAlert('error', 'The printed name cannot be empty.');
      return;
    }
    setForm((f) => ({ ...f, signatory_name: name }));
    if (form.signatory_priest_id) {
      const next = { ...signatoryNames, [form.signatory_priest_id]: name };
      localStorage.setItem(SIGNATORY_NAMES_KEY, JSON.stringify(next));
      setSignatoryNames(next);
      console.log('[Certificates] Printed name remembered', { priest: form.signatory_priest_id, name });
    }
    setEditingPrintedName(false);
  };

  const recordSignatoryUsage = (priestId: string) => {
    if (!priestId) return;
    const usage = readJson<Record<string, number>>(SIGNATORY_USAGE_KEY, {});
    usage[priestId] = (usage[priestId] || 0) + 1;
    localStorage.setItem(SIGNATORY_USAGE_KEY, JSON.stringify(usage));
    setDefaultSignatoryId(readDefaultSignatoryId());
  };

  const updateSponsor = (index: number, value: string) =>
    setForm((f) => ({ ...f, sponsors: f.sponsors.map((s, i) => (i === index ? value : s)) }));

  const addSponsor = () =>
    setForm((f) => (f.sponsors.length >= MAX_SPONSORS ? f : { ...f, sponsors: [...f.sponsors, ''] }));

  const removeSponsor = (index: number) =>
    setForm((f) => ({ ...f, sponsors: f.sponsors.length <= 1 ? [''] : f.sponsors.filter((_, i) => i !== index) }));

  const handleSaveAndPrint = async () => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      console.warn('[Certificates] Validation failed', found);
      onAlert('error', Object.values(found)[0] || 'Please complete the required fields.');
      return;
    }

    const details = toDetails(form);
    const payload = {
      certificate_type: 'baptismal' as const,
      ...details,
      signatory_priest_id: form.signatory_priest_id ? Number(form.signatory_priest_id) : null,
      baptism_id: source?.baptism_id ?? null,
      request_id: source?.request_id ?? null,
    };

    setSaving(true);
    console.log('[Certificates] Issuing certificate', payload);
    try {
      const res = await certificatesAPI.issue(payload);
      console.log('[Certificates] Certificate issued', res.data.data);
      setNotice({
        person_name: details.person_name,
        request_id: source?.request_id ?? null,
        request_status: source?.request_status ?? null,
        completed: false,
      });
      recordSignatoryUsage(form.signatory_priest_id);
      onIssued();
      onPrint(details);
    } catch (err: unknown) {
      console.error('[Certificates] Issue failed', err);
      const response = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response;
      const serverErrors = response?.data?.errors;
      if (serverErrors) {
        const mapped: FieldErrors = {};
        Object.entries(serverErrors).forEach(([k, v]) => {
          if (k in form) mapped[k as keyof FormState] = v[0];
        });
        setErrors(mapped);
      }
      onAlert('error', response?.data?.message || 'The certificate could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteRequest = async () => {
    if (!notice?.request_id) return;
    setCompleting(true);
    console.log('[Certificates] Completing request', notice.request_id);
    try {
      await certificatesAPI.completeRequest(notice.request_id);
      setNotice((n) => (n ? { ...n, completed: true } : n));
      setSource((s) => (s ? { ...s, request_status: 'done' } : s));
      setRefreshToken((t) => t + 1);
      onAlert('success', `Request #${notice.request_id} is now marked as completed and the parishioner has been notified.`);
    } catch (err: unknown) {
      console.error('[Certificates] Complete failed', err);
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      onAlert('error', message || 'The request could not be completed. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const details = toDetails(form);
  const futureBaptism = !!form.baptism_date && form.baptism_date > todayYmd();
  return (
    <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm min-w-0">
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Certificate for</p>
            <p className={`truncate text-base font-semibold ${source ? 'text-slate-900' : 'text-slate-400'}`}>
              {source ? source.label : 'No person selected yet'}
            </p>
            <p className="truncate text-xs text-slate-500">
              {source ? source.hint : 'Choose from the records or a request, or start a manual entry.'}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                source
                  ? 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                  : 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
              }`}
            >
              <UserSearch size={16} aria-hidden /> {source ? 'Change person' : 'Choose person'}
            </button>
            <button
              type="button"
              onClick={clearForm}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Eraser size={16} aria-hidden /> Clear
            </button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          <p className="text-xs text-slate-500">Everything below can be edited. Fields marked * are required.</p>
          {notice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
                <div className="flex-1">
                  <p className="font-medium">Certificate for {notice.person_name} was saved to the Issued Certificates history.</p>
                  {notice.request_id && notice.request_status === 'approved' && !notice.completed && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-emerald-700">Has the certificate been handed over?</span>
                      <button
                        type="button"
                        onClick={handleCompleteRequest}
                        disabled={completing}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {completing && <Loader2 size={14} className="animate-spin" aria-hidden />}
                        Mark request #{notice.request_id} as completed
                      </button>
                    </div>
                  )}
                  {notice.request_id && notice.request_status === 'pending' && (
                    <p className="mt-1 text-xs text-emerald-700">
                      Request #{notice.request_id} is still pending. Approve it in Manage Requests before marking it completed.
                    </p>
                  )}
                  {notice.completed && <p className="mt-1 text-xs text-emerald-700">Request #{notice.request_id} is now completed.</p>}
                </div>
              </div>
            </div>
          )}

          {futureBaptism && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
              <span>This baptism is scheduled for a future date. A certificate can only be printed after the baptism is done.</span>
            </div>
          )}

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Baptized person</legend>
            <Field label="Full name" htmlFor="cert-person" required error={errors.person_name}>
              <input id="cert-person" className={fieldClass(errors.person_name)} maxLength={150} value={form.person_name}
                onChange={(e) => update('person_name', e.target.value)} placeholder="e.g. Juan Santos Dela Cruz" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name of father" htmlFor="cert-father" error={errors.father_name}>
                <input id="cert-father" className={fieldClass(errors.father_name)} maxLength={150} value={form.father_name}
                  onChange={(e) => update('father_name', e.target.value)} placeholder="e.g. Pedro Dela Cruz" />
              </Field>
              <Field label="Name of mother" htmlFor="cert-mother" error={errors.mother_name}>
                <input id="cert-mother" className={fieldClass(errors.mother_name)} maxLength={150} value={form.mother_name}
                  onChange={(e) => update('mother_name', e.target.value)} placeholder="e.g. Maria Santos" />
              </Field>
              <Field label="Date of birth" htmlFor="cert-birth" required error={errors.birth_date}>
                <input id="cert-birth" type="date" max={todayYmd()} className={fieldClass(errors.birth_date)} value={form.birth_date}
                  onChange={(e) => update('birth_date', e.target.value)} />
              </Field>
              <Field label="Place of birth" htmlFor="cert-birthplace" error={errors.birth_place}>
                <input id="cert-birthplace" className={fieldClass(errors.birth_place)} maxLength={150} value={form.birth_place}
                  onChange={(e) => update('birth_place', e.target.value)} placeholder="e.g. Cagayan de Oro City" />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Baptism</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date of baptism" htmlFor="cert-baptism" required error={errors.baptism_date}>
                <input id="cert-baptism" type="date" max={todayYmd()} className={fieldClass(errors.baptism_date)} value={form.baptism_date}
                  onChange={(e) => update('baptism_date', e.target.value)} />
              </Field>
              <Field label="Baptized by" htmlFor="cert-minister" required error={errors.minister_name}>
                <PriestPicker
                  id="cert-minister"
                  priests={priests}
                  value={form.minister_name}
                  displayName={ministerDisplayName}
                  onChange={(name) => update('minister_name', name)}
                  placeholder="Search or type the priest’s name"
                  error={errors.minister_name}
                />
              </Field>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-700 mb-1">Sponsors (godparents)</span>
              <div className="space-y-2">
                {form.sponsors.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input aria-label={`Sponsor ${i + 1}`} className={`${inputClass} border-slate-200`} maxLength={100} value={s}
                      onChange={(e) => updateSponsor(i, e.target.value)} placeholder={`Sponsor ${i + 1}`} />
                    <button type="button" onClick={() => removeSponsor(i)} aria-label={`Remove sponsor ${i + 1}`}
                      className="shrink-0 rounded-lg border border-slate-200 px-3 text-slate-500 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              {form.sponsors.length < MAX_SPONSORS && (
                <button type="button" onClick={addSponsor}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                  <Plus size={14} aria-hidden /> Add sponsor
                </button>
              )}
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-700 mb-1">Baptismal Register</span>
              <div className="grid grid-cols-3 gap-2">
                <input aria-label="Register number" className={`${inputClass} border-slate-200`} maxLength={20} value={form.register_no}
                  onChange={(e) => update('register_no', e.target.value)} placeholder="No." />
                <input aria-label="Register page" className={`${inputClass} border-slate-200`} maxLength={20} value={form.register_page}
                  onChange={(e) => update('register_page', e.target.value)} placeholder="Page" />
                <input aria-label="Register line" className={`${inputClass} border-slate-200`} maxLength={20} value={form.register_line}
                  onChange={(e) => update('register_line', e.target.value)} placeholder="Line" />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {source?.baptism_id ? 'Saved to the baptism record so you won’t need to type it again.' : 'As written in the paper register.'}
              </p>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Issuance</legend>
            <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
              <Field label="Purpose" htmlFor="cert-purpose">
                <input id="cert-purpose" className={`${inputClass} border-slate-200`} maxLength={150} value={form.purpose}
                  onChange={(e) => update('purpose', e.target.value)} placeholder="Type or pick below" />
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Common purposes">
                  {PURPOSE_PRESETS.map((preset) => {
                    const selected = form.purpose.trim().toLowerCase() === preset.toLowerCase();
                    return (
                      <button
                        key={preset}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => update('purpose', preset)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Date issued" htmlFor="cert-issued" required error={errors.date_issued}>
                <input id="cert-issued" type="date" className={fieldClass(errors.date_issued)} value={form.date_issued}
                  onChange={(e) => update('date_issued', e.target.value)} />
              </Field>
            </div>

            <div>
              <label htmlFor="cert-signatory" className="block text-xs font-medium text-slate-700 mb-1">
                Signed by <span className="text-red-500">*</span>
              </label>

              {!form.signatory_name || changingSignatory ? (
                <>
                  <PriestPicker
                    id="cert-signatory"
                    priests={priests}
                    value={form.signatory_name}
                    selectedPriestId={form.signatory_priest_id || null}
                    defaultPriestId={defaultSignatoryId}
                    displayName={signatoryDisplayName}
                    onChange={chooseSignatory}
                    placeholder="Who will sign? Search or type a name"
                    error={errors.signatory_name}
                    autoOpen={changingSignatory}
                    onDismiss={() => setChangingSignatory(false)}
                  />
                  {errors.signatory_name ? (
                    <p className="mt-1 text-xs text-red-600" role="alert">{errors.signatory_name}</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">The priest whose name goes on the signature line.</p>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white" aria-hidden>
                      {priestInitials(form.signatory_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      {editingPrintedName ? (
                        <div>
                          <label htmlFor="cert-printed-name" className="block text-xs font-medium text-slate-600 mb-1">
                            Name exactly as printed
                          </label>
                          <input
                            id="cert-printed-name"
                            autoFocus
                            maxLength={150}
                            value={printedNameDraft}
                            onChange={(e) => setPrintedNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                savePrintedName();
                              } else if (e.key === 'Escape') {
                                e.stopPropagation();
                                setEditingPrintedName(false);
                              }
                            }}
                            placeholder="e.g. REV. FR. DOROTEO S. RABUYO JR., SSJV"
                            className={`${inputClass} border-slate-200 bg-white`}
                          />
                          <p className="mt-1 text-xs text-slate-400">
                            {form.signatory_priest_id
                              ? 'Add suffixes like JR. or SSJV. This is remembered for this priest.'
                              : 'Add suffixes like JR. or SSJV.'}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button type="button" onClick={savePrintedName}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                              Save name
                            </button>
                            <button type="button" onClick={() => setEditingPrintedName(false)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-bold uppercase text-slate-900 break-words">{form.signatory_name}</p>
                          <p className="text-xs text-slate-500">Parish Priest</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {form.signatory_priest_id && form.signatory_priest_id === defaultSignatoryId && (
                              <span className="rounded-full bg-blue-50 px-2 py-px text-[10px] font-medium text-blue-700">Default</span>
                            )}
                            {!form.signatory_priest_id && (
                              <span className="rounded-full bg-slate-100 px-2 py-px text-[10px] font-medium text-slate-600">Typed name</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    {!editingPrintedName && (
                      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                        <button type="button" onClick={startEditPrintedName}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          <PenLine size={13} aria-hidden /> Edit printed name
                        </button>
                        <button type="button" onClick={() => setChangingSignatory(true)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          <RefreshCw size={13} aria-hidden /> Change
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Printing saves the certificate to the history. Use Letter size with no margins, or choose “Save as PDF”.
            </p>
            <button
              type="button"
              onClick={handleSaveAndPrint}
              disabled={saving || futureBaptism}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Printer size={16} aria-hidden />}
              {saving ? 'Saving…' : 'Save & Print'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm min-w-0 xl:sticky xl:top-4">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Preview</h2>
          <p className="text-xs text-slate-500 mt-0.5">This is how the certificate will print. Blank lines mean the detail is missing.</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-b-xl">
          <div ref={previewBoxRef} className="w-full">
            <div
              className="mx-auto overflow-hidden shadow-md ring-1 ring-slate-200"
              style={{ width: SHEET_WIDTH_IN * PX_PER_IN * previewScale, height: SHEET_HEIGHT_IN * PX_PER_IN * previewScale }}
            >
              <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                <BaptismalCertificateSheet data={details} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <div
          className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="certificate-picker-title"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl ring-1 ring-slate-200 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <SourcePicker
              tab={tab}
              onTabChange={setTab}
              selectedKey={source?.key ?? null}
              onPickRecord={pickRecord}
              onPickRequest={pickRequest}
              onStartManual={startManual}
              onClose={() => setPickerOpen(false)}
              refreshToken={refreshToken}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateCertificate;
