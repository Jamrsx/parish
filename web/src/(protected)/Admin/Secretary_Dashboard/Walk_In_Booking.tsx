import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus, ChevronLeft } from "lucide-react";
import PageHeader from "./components/PageHeader";
import { churchServiceAPI, formatFee, type ChurchService } from "../../../../library/church_service";
import { manageRequestAPI } from "../../../../library/manage-request";
import { useBookedTimeSlots } from "./hooks/useBookedTimeSlots";
import AlertModal from "./Inventory/Modals/AlertModal";

const TIME_OPTIONS = [
  { label: "8:00 AM", value: "08:00" },
  { label: "9:00 AM", value: "09:00" },
  { label: "10:00 AM", value: "10:00" },
  { label: "11:00 AM", value: "11:00" },
  { label: "12:00 PM", value: "12:00" },
  { label: "1:00 PM", value: "13:00" },
  { label: "2:00 PM", value: "14:00" },
  { label: "3:00 PM", value: "15:00" },
  { label: "4:00 PM", value: "16:00" },
  { label: "5:00 PM", value: "17:00" },
];

const emptyForm = () => ({
  first_name: "",
  middle_name: "",
  last_name: "",
  contact_number: "",
  address: "",
  preferred_date: "",
  preferred_time: "",
  child_first_name: "",
  child_middle_name: "",
  child_last_name: "",
  child_birth_date: "",
  child_birth_place: "",
  mother_first_name: "",
  mother_middle_name: "",
  mother_last_name: "",
  father_first_name: "",
  father_middle_name: "",
  father_last_name: "",
  birth_date: "",
  marriage_date: "",
  intention_text: "",
});

const inputClass =
  "w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent";

const WalkInBooking: React.FC = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<ChurchService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selected, setSelected] = useState<ChurchService | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [isResident, setIsResident] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const { bookedSlots, loading: slotsLoading } = useBookedTimeSlots(form.preferred_date);
  const isCertificate = selected?.form_type === "certificate" || selected?.is_certificate;

  const loadServices = useCallback(async () => {
    try {
      setLoadingServices(true);
      const res = await churchServiceAPI.getOptions();
      const all = (res.data.data?.all || []) as ChurchService[];
      const active = all.filter((s) => s.is_active !== false);
      console.log("Walk-in services loaded:", active.length);
      setServices(active);
    } catch (err) {
      console.error("Walk-in services error:", err);
      setAlert({ type: "error", message: "Could not load church services." });
    } finally {
      setLoadingServices(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const setField = (key: keyof ReturnType<typeof emptyForm>, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    console.log("Walk-in contact number:", digits);
    setField("contact_number", digits);
  };

  const formType = selected?.form_type || (selected?.is_baptism ? "baptism" : selected?.is_certificate ? "certificate" : "service");

  const validateClient = () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      return "First name and last name are required.";
    }
    if (!/^09\d{9}$/.test(form.contact_number)) {
      return "Contact number must be 11 digits and start with 09.";
    }
    if (!isResident && !form.address.trim()) {
      return "Address is required for a non-resident.";
    }
    if (!form.preferred_date || !form.preferred_time) {
      return "Preferred date and time are required.";
    }
    if (formType === "baptism") {
      if (!form.child_first_name.trim() || !form.child_last_name.trim() || !form.child_birth_date) {
        return "Child first name, last name, and birth date are required.";
      }
      if (!form.mother_first_name.trim() || !form.mother_last_name.trim()) {
        return "Mother first name and last name are required.";
      }
      if (!form.father_first_name.trim() || !form.father_last_name.trim()) {
        return "Father first name and last name are required.";
      }
    }
    if (formType === "certificate") {
      const type = (selected?.service_type || "").toLowerCase();
      if (type.includes("marriage") && !form.marriage_date) {
        return "Marriage date is required.";
      }
      if (!type.includes("marriage") && !form.birth_date) {
        return "Birth date is required.";
      }
    }
    if (formType === "special_intention" && form.intention_text.trim().length < 5) {
      return "Intention text must be at least 5 characters.";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const error = validateClient();
    if (error) {
      setAlert({ type: "error", message: error });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        service_id: selected.service_id,
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || undefined,
        last_name: form.last_name.trim(),
        contact_number: form.contact_number,
        is_resident: isResident ? 1 : 0,
        address: isResident ? undefined : form.address.trim(),
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time,
        ...(formType === "baptism"
          ? {
              child_first_name: form.child_first_name.trim(),
              child_middle_name: form.child_middle_name.trim() || undefined,
              child_last_name: form.child_last_name.trim(),
              child_birth_date: form.child_birth_date,
              child_birth_place: form.child_birth_place.trim() || undefined,
              mother_first_name: form.mother_first_name.trim(),
              mother_middle_name: form.mother_middle_name.trim() || undefined,
              mother_last_name: form.mother_last_name.trim(),
              father_first_name: form.father_first_name.trim(),
              father_middle_name: form.father_middle_name.trim() || undefined,
              father_last_name: form.father_last_name.trim(),
            }
          : {}),
        ...(formType === "certificate"
          ? {
              birth_date: form.birth_date || undefined,
              marriage_date: form.marriage_date || undefined,
            }
          : {}),
        ...(formType === "special_intention" ? { intention_text: form.intention_text.trim() } : {}),
      };

      const res = await manageRequestAPI.createWalkInBooking(payload);
      console.log("Walk-in booking response:", res.data);
      if (res.data.success) {
        setAlert({
          type: "success",
          message: res.data.message || "Walk-in booking saved.",
        });
        setSelected(null);
        setForm(emptyForm());
        setIsResident(true);
      } else {
        setAlert({ type: "error", message: res.data.message || "Could not save booking." });
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      console.error("Walk-in booking error:", err);
      setAlert({
        type: "error",
        message: axiosErr.response?.data?.message || "Could not save the walk-in booking.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const availableTimes = useMemo(() => {
    if (isCertificate) return TIME_OPTIONS;
    return TIME_OPTIONS.filter((opt) => !bookedSlots.includes(opt.value) && !bookedSlots.includes(`${opt.value}:00`));
  }, [bookedSlots, isCertificate]);

  return (
    <div>
      <PageHeader
        icon={CalendarPlus}
        title="Walk-in Booking"
        description="Book a church service for a walk-in parishioner or client. The booking is approved and sent to cashier as unpaid."
      />

      {!selected ? (
        <>
          <p className="text-sm text-slate-600 mb-4">Choose a service the church currently offers.</p>
          {loadingServices ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 rounded-xl border border-slate-200 bg-white animate-pulse" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <p className="text-slate-500">No active services. Add them in Manage Services.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <button
                  key={service.service_id}
                  type="button"
                  onClick={() => {
                    console.log("Walk-in service selected:", service.service_id, service.service_type);
                    setSelected(service);
                    setForm(emptyForm());
                    setIsResident(true);
                  }}
                  className="text-left bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition"
                >
                  <p className="font-semibold text-slate-900">{service.service_name || service.service_type}</p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{service.description || "Church service"}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-semibold text-blue-700">{formatFee(service.fee)}</span>
                    <span className="text-[11px] uppercase font-semibold text-slate-500">
                      {service.category || "service"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
          >
            <ChevronLeft size={16} />
            Change service
          </button>

          <div>
            <h2 className="text-lg font-semibold text-slate-900">{selected.service_name || selected.service_type}</h2>
            <p className="text-sm text-slate-500">
              Fee {formatFee(selected.fee)}
              {isCertificate ? " · Certificate visit time" : " · Church schedule"}
            </p>
          </div>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Walk-in client</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input className={inputClass} placeholder="First name *" value={form.first_name} onChange={(e) => setField("first_name", e.target.value)} />
              <input className={inputClass} placeholder="Middle name" value={form.middle_name} onChange={(e) => setField("middle_name", e.target.value)} />
              <input className={inputClass} placeholder="Last name *" value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} />
              <input
                className={inputClass}
                placeholder="09XXXXXXXXX *"
                maxLength={11}
                value={form.contact_number}
                onChange={(e) => handlePhone(e.target.value)}
              />
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Residency</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    console.log("Walk-in residency: resident");
                    setIsResident(true);
                    setField("address", "");
                  }}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium text-left ${
                    isResident
                      ? "border-blue-600 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  Resident
                  <span className="block text-xs font-normal text-slate-500 mt-0.5">Lives in the parish</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    console.log("Walk-in residency: non-resident");
                    setIsResident(false);
                  }}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium text-left ${
                    !isResident
                      ? "border-blue-600 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  Non-resident
                  <span className="block text-xs font-normal text-slate-500 mt-0.5">Lives outside the parish</span>
                </button>
              </div>
            </div>
            {!isResident && (
              <input
                className={`${inputClass} mt-3`}
                placeholder="Complete address *"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
              />
            )}
          </section>

          {formType === "baptism" && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Child</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input className={inputClass} placeholder="Child first name *" value={form.child_first_name} onChange={(e) => setField("child_first_name", e.target.value)} />
                <input className={inputClass} placeholder="Child middle name" value={form.child_middle_name} onChange={(e) => setField("child_middle_name", e.target.value)} />
                <input className={inputClass} placeholder="Child last name *" value={form.child_last_name} onChange={(e) => setField("child_last_name", e.target.value)} />
                <input className={inputClass} type="date" value={form.child_birth_date} onChange={(e) => setField("child_birth_date", e.target.value)} />
                <input className={`${inputClass} sm:col-span-2`} placeholder="Birth place" value={form.child_birth_place} onChange={(e) => setField("child_birth_place", e.target.value)} />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 pt-2">Parents</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input className={inputClass} placeholder="Mother first name *" value={form.mother_first_name} onChange={(e) => setField("mother_first_name", e.target.value)} />
                <input className={inputClass} placeholder="Mother middle name" value={form.mother_middle_name} onChange={(e) => setField("mother_middle_name", e.target.value)} />
                <input className={inputClass} placeholder="Mother last name *" value={form.mother_last_name} onChange={(e) => setField("mother_last_name", e.target.value)} />
                <input className={inputClass} placeholder="Father first name *" value={form.father_first_name} onChange={(e) => setField("father_first_name", e.target.value)} />
                <input className={inputClass} placeholder="Father middle name" value={form.father_middle_name} onChange={(e) => setField("father_middle_name", e.target.value)} />
                <input className={inputClass} placeholder="Father last name *" value={form.father_last_name} onChange={(e) => setField("father_last_name", e.target.value)} />
              </div>
            </section>
          )}

          {formType === "certificate" && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Certificate details</h3>
              {(selected.service_type || "").toLowerCase().includes("marriage") ? (
                <input className={inputClass} type="date" value={form.marriage_date} onChange={(e) => setField("marriage_date", e.target.value)} />
              ) : (
                <input className={inputClass} type="date" value={form.birth_date} onChange={(e) => setField("birth_date", e.target.value)} />
              )}
            </section>
          )}

          {formType === "special_intention" && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Intention</h3>
              <textarea
                className={`${inputClass} min-h-[96px]`}
                placeholder="Prayer intention *"
                value={form.intention_text}
                onChange={(e) => setField("intention_text", e.target.value)}
              />
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Schedule</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className={inputClass}
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={form.preferred_date}
                onChange={(e) => {
                  setField("preferred_date", e.target.value);
                  setField("preferred_time", "");
                }}
              />
              <select
                className={inputClass}
                value={form.preferred_time}
                onChange={(e) => setField("preferred_time", e.target.value)}
                disabled={!form.preferred_date || slotsLoading}
              >
                <option value="">{slotsLoading ? "Loading times…" : "Select time"}</option>
                {availableTimes.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {form.preferred_date && !isCertificate && availableTimes.length === 0 && !slotsLoading && (
              <p className="text-sm text-amber-700 mt-2">No open time slots on this date.</p>
            )}
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save walk-in booking"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/secretary/manage-requests")}
              className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
            >
              Open Manage Requests
            </button>
          </div>
        </form>
      )}

      <AlertModal
        isOpen={!!alert}
        type={alert?.type || "error"}
        message={alert?.message || ""}
        onClose={() => setAlert(null)}
      />
    </div>
  );
};

export default WalkInBooking;
