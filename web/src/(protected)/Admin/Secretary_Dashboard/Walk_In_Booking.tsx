import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus, ChevronLeft, Plus, Pencil, Trash2, X } from "lucide-react";
import PageHeader from "./components/PageHeader";
import { churchServiceAPI, formatFee, type ChurchService } from "../../../../library/church_service";
import { manageRequestAPI } from "../../../../library/manage-request";
import { useBookedTimeSlots } from "./hooks/useBookedTimeSlots";
import AlertModal from "./Inventory/Modals/AlertModal";

type WalkInGodparent = {
  godparent_name: string;
  relationship: "godfather" | "godmother";
};

type GodparentNameRow = {
  first_name: string;
  middle_name: string;
  last_name: string;
};

const emptyGodparentRow = (): GodparentNameRow => ({
  first_name: "",
  middle_name: "",
  last_name: "",
});

const formatGodparentFullName = (row: GodparentNameRow): string =>
  [row.first_name, row.middle_name, row.last_name]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

const splitGodparentFullName = (full: string): GodparentNameRow => {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return emptyGodparentRow();
  if (parts.length === 1) return { first_name: parts[0], middle_name: "", last_name: "" };
  if (parts.length === 2) return { first_name: parts[0], middle_name: "", last_name: parts[1] };
  return {
    first_name: parts[0],
    middle_name: parts.slice(1, -1).join(" "),
    last_name: parts[parts.length - 1],
  };
};

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
  baptism_date: "",
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
  const [godparents, setGodparents] = useState<WalkInGodparent[]>([]);
  const [gpModalOpen, setGpModalOpen] = useState(false);
  const [gpEditingIndex, setGpEditingIndex] = useState<number | null>(null);
  const [gpRelationship, setGpRelationship] = useState<"godfather" | "godmother">("godfather");
  const [gpRows, setGpRows] = useState<GodparentNameRow[]>([emptyGodparentRow()]);
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
      const validGps = godparents.filter((gp) => gp.godparent_name.trim());
      if (validGps.length === 0) {
        return "Add at least one godparent (ninong or ninang).";
      }
    }
    if (formType === "certificate") {
      const type = (selected?.service_type || "").toLowerCase();
      if (type.includes("marriage") && !form.marriage_date) {
        return "Marriage date is required.";
      }
      if (!type.includes("marriage")) {
        if (!form.birth_date) {
          return "Birth date is required.";
        }
        if (!form.baptism_date) {
          return "Baptism date is required.";
        }
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
              godparents: godparents
                .filter((gp) => gp.godparent_name.trim())
                .map((gp) => ({
                  godparent_name: gp.godparent_name.trim(),
                  relationship: gp.relationship,
                })),
            }
          : {}),
        ...(formType === "certificate"
          ? {
              birth_date: form.birth_date || undefined,
              baptism_date: form.baptism_date || undefined,
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
        setGodparents([]);
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

  const godfathers = godparents.filter((gp) => gp.relationship === "godfather");
  const godmothers = godparents.filter((gp) => gp.relationship === "godmother");

  const openAddGodparent = () => {
    setGpEditingIndex(null);
    setGpRelationship("godfather");
    setGpRows([emptyGodparentRow()]);
    setGpModalOpen(true);
    console.log("Walk-in open add godparent rows");
  };

  const openEditGodparent = (index: number) => {
    const current = godparents[index];
    setGpEditingIndex(index);
    setGpRelationship(current.relationship);
    setGpRows([splitGodparentFullName(current.godparent_name)]);
    setGpModalOpen(true);
    console.log("Walk-in edit godparent index:", index);
  };

  const updateGodparentRow = (index: number, key: keyof GodparentNameRow, value: string) => {
    setGpRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addGodparentRow = () => {
    setGpRows((prev) => [...prev, emptyGodparentRow()]);
    console.log("Walk-in add another godparent row");
  };

  const removeGodparentRow = (index: number) => {
    setGpRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const saveGodparent = () => {
    const roleLabel = gpRelationship === "godfather" ? "godfather" : "godmother";

    if (gpEditingIndex !== null) {
      const fullName = formatGodparentFullName(gpRows[0] || emptyGodparentRow());
      if (!gpRows[0]?.first_name.trim() || !gpRows[0]?.last_name.trim()) {
        setAlert({ type: "error", message: "First name and last name are required." });
        return;
      }
      setGodparents((prev) =>
        prev.map((gp, i) =>
          i === gpEditingIndex
            ? { godparent_name: fullName, relationship: gpRelationship }
            : gp
        )
      );
      console.log("Walk-in godparent updated:", fullName, roleLabel);
      setGpModalOpen(false);
      return;
    }

    const prepared: WalkInGodparent[] = [];
    for (let i = 0; i < gpRows.length; i++) {
      const row = gpRows[i];
      const first = row.first_name.trim();
      const last = row.last_name.trim();
      if (!first && !last && !row.middle_name.trim()) continue;
      if (!first || !last) {
        setAlert({
          type: "error",
          message: `Row ${i + 1}: first name and last name are required.`,
        });
        return;
      }
      prepared.push({
        godparent_name: formatGodparentFullName(row),
        relationship: gpRelationship,
      });
    }

    if (prepared.length === 0) {
      setAlert({ type: "error", message: "Add at least one godparent with first and last name." });
      return;
    }

    setGodparents((prev) => [...prev, ...prepared]);
    console.log("Walk-in godparents added from rows:", prepared.length, roleLabel);
    setGpModalOpen(false);
  };

  const removeGodparent = (index: number) => {
    console.log("Walk-in remove godparent index:", index);
    setGodparents((prev) => prev.filter((_, i) => i !== index));
  };

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
                    setGodparents([]);
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

              <div className="pt-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Godparents</h3>
                  <button
                    type="button"
                    onClick={openAddGodparent}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-blue-600 mb-2">Godfathers ({godfathers.length})</p>
                    {godfathers.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">None added yet</p>
                    ) : (
                      <div className="space-y-2">
                        {godfathers.map((gp) => {
                          const index = godparents.indexOf(gp);
                          return (
                            <div
                              key={`gf-${index}`}
                              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-blue-100 bg-blue-50/50"
                            >
                              <span className="text-sm text-slate-800 truncate">{gp.godparent_name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button type="button" onClick={() => openEditGodparent(index)} className="p-1 text-slate-400 hover:text-blue-600" title="Edit">
                                  <Pencil size={14} />
                                </button>
                                <button type="button" onClick={() => removeGodparent(index)} className="p-1 text-slate-400 hover:text-red-600" title="Remove">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-rose-600 mb-2">Godmothers ({godmothers.length})</p>
                    {godmothers.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">None added yet</p>
                    ) : (
                      <div className="space-y-2">
                        {godmothers.map((gp) => {
                          const index = godparents.indexOf(gp);
                          return (
                            <div
                              key={`gm-${index}`}
                              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-rose-100 bg-rose-50/50"
                            >
                              <span className="text-sm text-slate-800 truncate">{gp.godparent_name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button type="button" onClick={() => openEditGodparent(index)} className="p-1 text-slate-400 hover:text-rose-600" title="Edit">
                                  <Pencil size={14} />
                                </button>
                                <button type="button" onClick={() => removeGodparent(index)} className="p-1 text-slate-400 hover:text-red-600" title="Remove">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {formType === "certificate" && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Certificate details</h3>
              {(selected.service_type || "").toLowerCase().includes("marriage") ? (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Marriage date *</label>
                  <input className={inputClass} type="date" value={form.marriage_date} onChange={(e) => setField("marriage_date", e.target.value)} />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Birth date *</label>
                    <input className={inputClass} type="date" value={form.birth_date} onChange={(e) => setField("birth_date", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Baptism date *</label>
                    <input className={inputClass} type="date" value={form.baptism_date} onChange={(e) => setField("baptism_date", e.target.value)} />
                  </div>
                </div>
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

      {gpModalOpen && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">
                {gpEditingIndex !== null ? "Edit Godparent" : "Add Godparent"}
              </h3>
              <button type="button" onClick={() => setGpModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGpRelationship("godfather")}
                  className={`px-3 py-2.5 rounded-lg text-sm font-semibold ${
                    gpRelationship === "godfather"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  Godfather
                </button>
                <button
                  type="button"
                  onClick={() => setGpRelationship("godmother")}
                  className={`px-3 py-2.5 rounded-lg text-sm font-semibold ${
                    gpRelationship === "godmother"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  Godmother
                </button>
              </div>

              {gpRows.map((row, index) => {
                const roleWord = gpRelationship === "godfather" ? "godfather" : "godmother";
                return (
                  <div key={`gp-row-${index}`} className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {gpEditingIndex !== null ? "Godparent" : `Person ${index + 1}`}
                      </p>
                      {gpEditingIndex === null && gpRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGodparentRow(index)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
                      <input
                        className={inputClass}
                        placeholder={`Enter ${roleWord} first name`}
                        value={row.first_name}
                        onChange={(e) => updateGodparentRow(index, "first_name", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Middle Name</label>
                      <input
                        className={inputClass}
                        placeholder={`Enter ${roleWord} middle name`}
                        value={row.middle_name}
                        onChange={(e) => updateGodparentRow(index, "middle_name", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label>
                      <input
                        className={inputClass}
                        placeholder={`Enter ${roleWord} last name`}
                        value={row.last_name}
                        onChange={(e) => updateGodparentRow(index, "last_name", e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}

              {gpEditingIndex === null && (
                <button
                  type="button"
                  onClick={addGodparentRow}
                  className="w-full inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg border border-dashed border-blue-300 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  <Plus size={16} />
                  Add another
                </button>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={saveGodparent}
                className="w-full px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {gpEditingIndex !== null
                  ? "Save changes"
                  : `Add Godparent${gpRows.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalkInBooking;
