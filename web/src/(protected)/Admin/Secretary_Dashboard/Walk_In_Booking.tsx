import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus, CheckCircle2, ChevronLeft, Clock, Info, Loader2, Plus, Pencil, Trash2, X } from "lucide-react";
import PageHeader from "./components/PageHeader";
import ModalCloseButton from "./components/ModalCloseButton";
import { churchServiceAPI, formatFee, type ChurchService } from "../../../../library/church_service";
import { manageRequestAPI, getUserFullName } from "../../../../library/manage-request";
import { usersAPI } from "../../../../library/api";
import type { User } from "../../../../library/AuthStorage";
import { useBookedTimeSlots } from "./hooks/useBookedTimeSlots";
import { availabilityAPI } from "../../../../library/Availability";
import ServiceDatePicker from "../../../components/booking/ServiceDatePicker";
import { buildTimeOptions } from "../../../components/booking/serviceSlots";
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

const AUTO_SLOT_SEARCH_DAYS = 30;

const toYmd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const toHm = (d: Date): string => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const addDaysYmd = (ymd: string, days: number): string => {
  const [y, m, d] = ymd.split("-").map(Number);
  return toYmd(new Date(y, m - 1, d + days));
};

/** "09:34" → "9:34 AM" */
const formatTimeLabel = (hm: string): string => {
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hm;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
};

const formatShortDate = (ymd: string): string =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });

/** Hourly slots that are not booked and, for today, not already past. */
const openTimesFor = (date: string, booked: string[], skipBooked: boolean): typeof TIME_OPTIONS => {
  const now = new Date();
  const isToday = date === toYmd(now);
  const nowHm = toHm(now);
  return TIME_OPTIONS.filter((opt) => {
    if (isToday && opt.value <= nowHm) return false;
    if (!skipBooked) return true;
    return !booked.includes(opt.value) && !booked.includes(`${opt.value}:00`);
  });
};

type AddressParts = {
  addr_street: string;
  addr_barangay: string;
  addr_city: string;
  addr_province: string;
  addr_zip: string;
  addr_country: string;
};

/** "Purok 3, Bulua, Cagayan de Oro City, Misamis Oriental 9000, Philippines" */
const composeAddress = (a: AddressParts): string =>
  [
    a.addr_street,
    a.addr_barangay,
    a.addr_city,
    [a.addr_province.trim(), a.addr_zip.trim()].filter(Boolean).join(" "),
    a.addr_country,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

const emptyForm = () => ({
  first_name: "",
  middle_name: "",
  last_name: "",
  husband_name: "",
  wife_name: "",
  contact_number: "",
  addr_street: "",
  addr_barangay: "",
  addr_city: "",
  addr_province: "",
  addr_zip: "",
  addr_country: "Philippines",
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
  cert_father_name: "",
  cert_mother_name: "",
  cert_birth_place: "",
  intention_text: "",
});

const isCoupleWalkInService = (service: ChurchService | null, formType: string): boolean => {
  if (!service) return false;
  const type = `${service.service_type || ""} ${service.service_name || ""}`.toLowerCase();
  const handler = (service.form_handler || "").toLowerCase();
  if (formType === "certificate") {
    return type.includes("marriage") || handler.includes("marriage");
  }
  if (formType === "service") {
    return (
      type.trim() === "marriage" ||
      handler === "marriage" ||
      (type.includes("marriage") && !type.includes("certificate"))
    );
  }
  return false;
};

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
  const [priestModalOpen, setPriestModalOpen] = useState(false);
  const [priests, setPriests] = useState<User[]>([]);
  const [priestsLoading, setPriestsLoading] = useState(false);
  const [selectedPriestId, setSelectedPriestId] = useState<number | null>(null);

  const { bookedSlots, loading: slotsLoading } = useBookedTimeSlots(form.preferred_date);
  const isCertificate = selected?.form_type === "certificate" || selected?.is_certificate;

  // Certificates: the parishioner is at the counter, so the visit time is "now" unless the secretary changes it.
  const [certUseNow, setCertUseNow] = useState(true);
  const [nowTick, setNowTick] = useState(() => new Date());
  // Services: earliest open slot is picked automatically.
  const [autoPicking, setAutoPicking] = useState(false);
  const [scheduleNote, setScheduleNote] = useState<string | null>(null);
  const autoPickRun = useRef(0);

  const certNowActive = !!isCertificate && certUseNow;

  useEffect(() => {
    if (!certNowActive) return;
    const timer = setInterval(() => setNowTick(new Date()), 30000);
    return () => clearInterval(timer);
  }, [certNowActive]);

  /** Finds the first open hourly slot from `startDate`, looking ahead `days` days. */
  const autoPickSlot = useCallback(async (startDate: string, days: number) => {
    const run = ++autoPickRun.current;
    setAutoPicking(true);
    setScheduleNote(null);
    console.log("[WalkIn] Auto-picking earliest slot", { startDate, days });
    try {
      for (let i = 0; i < days; i++) {
        const date = addDaysYmd(startDate, i);
        const res = await availabilityAPI.getBookedTimeSlots(date);
        if (run !== autoPickRun.current) return;
        const booked = res.success ? res.data?.booked_times || [] : [];
        const open = openTimesFor(date, booked, true);
        if (open.length > 0) {
          console.log("[WalkIn] Earliest open slot", { date, time: open[0].value });
          setForm((prev) => ({ ...prev, preferred_date: date, preferred_time: open[0].value }));
          setScheduleNote(
            i === 0
              ? "Earliest open time selected automatically. You can still change it."
              : `${startDate === toYmd(new Date()) ? "Today" : formatShortDate(startDate)} is fully booked. Moved to ${formatShortDate(date)}, the next open day.`,
          );
          return;
        }
      }
      setForm((prev) => ({ ...prev, preferred_date: startDate, preferred_time: "" }));
      setScheduleNote(
        days > 1
          ? `No open time in the next ${days} days. Please pick a date.`
          : "No open time slots on this date. Please pick another date.",
      );
    } catch (err) {
      console.error("[WalkIn] Auto-pick slot failed", err);
      if (run === autoPickRun.current) setScheduleNote("Could not check open times. Please pick the time manually.");
    } finally {
      if (run === autoPickRun.current) setAutoPicking(false);
    }
  }, []);

  const startSchedule = (service: ChurchService) => {
    const certificate = service.form_type === "certificate" || !!service.is_certificate;
    const now = new Date();
    setScheduleNote(null);
    if (certificate) {
      autoPickRun.current++;
      setAutoPicking(false);
      setCertUseNow(true);
      setNowTick(now);
      setForm((prev) => ({ ...prev, preferred_date: toYmd(now), preferred_time: toHm(now) }));
      console.log("[WalkIn] Certificate visit time set to now", { date: toYmd(now), time: toHm(now) });
    } else {
      void autoPickSlot(toYmd(now), AUTO_SLOT_SEARCH_DAYS);
    }
  };

  const switchCertToManual = () => {
    console.log("[WalkIn] Certificate time: manual");
    setCertUseNow(false);
    setForm((prev) => ({ ...prev, preferred_date: toYmd(new Date()), preferred_time: "" }));
  };

  const switchCertToNow = () => {
    const now = new Date();
    console.log("[WalkIn] Certificate time: back to now");
    setCertUseNow(true);
    setNowTick(now);
    setForm((prev) => ({ ...prev, preferred_date: toYmd(now), preferred_time: toHm(now) }));
  };

  const handleDateChange = (date: string) => {
    setForm((prev) => ({ ...prev, preferred_date: date, preferred_time: "" }));
    if (!isCertificate && date) void autoPickSlot(date, 1);
    else setScheduleNote(null);
  };

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
  const isCoupleBooking = isCoupleWalkInService(selected, formType);

  const validateClient = () => {
    if (isCoupleBooking) {
      if (!form.husband_name.trim() || !form.wife_name.trim()) {
        return "Husband and wife full names are required.";
      }
      if (form.husband_name.trim().length > 50 || form.wife_name.trim().length > 50) {
        return "Each full name must be 50 characters or less.";
      }
    } else if (!form.first_name.trim() || !form.last_name.trim()) {
      return "First name and last name are required.";
    }
    if (!/^09\d{9}$/.test(form.contact_number)) {
      return "Contact number must be 11 digits and start with 09.";
    }
    if (!isResident) {
      if (!form.addr_barangay.trim()) return "Barangay is required for a non-resident.";
      if (!form.addr_city.trim()) return "City / Municipality is required for a non-resident.";
      if (!form.addr_province.trim()) return "Province is required for a non-resident.";
      if (!form.addr_country.trim()) return "Country is required for a non-resident.";
      if (form.addr_zip.trim() && !/^\d{4}$/.test(form.addr_zip.trim())) return "ZIP code must be 4 digits.";
      if (composeAddress(form).length > 500) return "The address is too long. Please shorten it.";
    }
    if (!certNowActive) {
      if (autoPicking) return "Still finding the earliest open time. Please wait a moment.";
      if (!form.preferred_date || !form.preferred_time) {
        return "Preferred date and time are required.";
      }
      if (form.preferred_date === toYmd(new Date()) && form.preferred_time <= toHm(new Date())) {
        return "That time has already passed today. Please pick a later time.";
      }
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
        if (!form.cert_father_name.trim()) {
          return "Father's full name is required.";
        }
        if (!form.cert_mother_name.trim()) {
          return "Mother's full name is required.";
        }
        if (!form.birth_date) {
          return "Birth date is required.";
        }
        if (!form.cert_birth_place.trim()) {
          return "Place of birth is required.";
        }
        if (!form.baptism_date) {
          return "Baptism date is required.";
        }
        if (form.baptism_date < form.birth_date) {
          return "Baptism date cannot be before the birth date.";
        }
      }
    }
    if (formType === "special_intention" && form.intention_text.trim().length < 5) {
      return "Intention text must be at least 5 characters.";
    }
    return null;
  };

  const loadPriests = useCallback(async () => {
    setPriestsLoading(true);
    try {
      const res = await usersAPI.listPriests({ activeOnly: true, availableOnly: true });
      const payload = res.data?.data as unknown;
      const list: User[] = Array.isArray(payload)
        ? (payload as User[])
        : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
          ? ((payload as { data: User[] }).data)
          : [];
      console.log("[WalkIn] Priests loaded:", list.length);
      setPriests(list);
      setSelectedPriestId((current) => (current && list.some((p) => p.user_id === current) ? current : null));
    } catch (err) {
      console.error("[WalkIn] Priests load error:", err);
      setPriests([]);
    } finally {
      setPriestsLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const error = validateClient();
    if (error) {
      setAlert({ type: "error", message: error });
      return;
    }

    console.log("[WalkIn] Form valid, opening priest assignment", {
      service_id: selected.service_id,
      priestOptional: !!isCertificate,
    });
    setPriestModalOpen(true);
    loadPriests();
  };

  const closePriestModal = () => {
    if (submitting) return;
    console.log("[WalkIn] Priest assignment cancelled, back to form");
    setPriestModalOpen(false);
  };

  const saveBooking = async (priestId: number | null) => {
    if (!selected) return;
    if (!priestId && !isCertificate) {
      setAlert({ type: "error", message: "Please assign a priest before saving this booking." });
      return;
    }

    setSubmitting(true);
    try {
      const husband = form.husband_name.trim();
      const wife = form.wife_name.trim();
      const couplePayload = isCoupleBooking
        ? {
            first_name: husband,
            middle_name: "&",
            last_name: wife,
          }
        : {
            first_name: form.first_name.trim(),
            middle_name: form.middle_name.trim() || undefined,
            last_name: form.last_name.trim(),
          };

      console.log("Walk-in booking name payload:", {
        isCoupleBooking,
        ...couplePayload,
      });

      const savedAt = new Date();
      const schedule = certNowActive
        ? { preferred_date: toYmd(savedAt), preferred_time: toHm(savedAt) }
        : { preferred_date: form.preferred_date, preferred_time: form.preferred_time };
      const address = isResident ? undefined : composeAddress(form);
      console.log("[WalkIn] Schedule and address", { ...schedule, certNowActive, address });

      const payload = {
        service_id: selected.service_id,
        ...couplePayload,
        contact_number: form.contact_number,
        is_resident: isResident ? 1 : 0,
        address,
        ...schedule,
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
              father_name: form.cert_father_name.trim() || undefined,
              mother_name: form.cert_mother_name.trim() || undefined,
              birth_place: form.cert_birth_place.trim() || undefined,
            }
          : {}),
        ...(formType === "special_intention" ? { intention_text: form.intention_text.trim() } : {}),
        assigned_priest: priestId,
      };

      console.log("[WalkIn] Saving booking with priest:", priestId);
      const res = await manageRequestAPI.createWalkInBooking(payload);
      console.log("Walk-in booking response:", res.data);
      if (res.data.success) {
        setPriestModalOpen(false);
        setSelectedPriestId(null);
        setAlert({
          type: "success",
          message: res.data.message || "Walk-in booking saved.",
        });
        setSelected(null);
        setForm(emptyForm());
        setIsResident(true);
        setGodparents([]);
        setScheduleNote(null);
        setCertUseNow(true);
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

  const timeChoices = useMemo(
    () => (form.preferred_date ? buildTimeOptions(form.preferred_date, bookedSlots, !isCertificate) : []),
    [form.preferred_date, bookedSlots, isCertificate],
  );
  const hasOpenTime = timeChoices.some((opt) => !opt.disabled);

  const summaryClientName = isCoupleBooking
    ? `${form.husband_name.trim()} & ${form.wife_name.trim()}`
    : [form.first_name, form.middle_name, form.last_name].map((p) => p.trim()).filter(Boolean).join(" ");
  const effectiveDate = certNowActive ? toYmd(nowTick) : form.preferred_date;
  const effectiveTime = certNowActive ? toHm(nowTick) : form.preferred_time;
  const summaryDate = effectiveDate
    ? new Date(`${effectiveDate}T00:00:00`).toLocaleDateString("en-PH", {
        weekday: "short",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const summaryTime = effectiveTime ? `${formatTimeLabel(effectiveTime)}${certNowActive ? " (now)" : ""}` : "—";
  const selectedPriest = priests.find((p) => p.user_id === selectedPriestId) || null;

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
                    startSchedule(service);
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
              {isCoupleBooking ? "Couple information" : "Walk-in client"}
            </h3>
            {isCoupleBooking ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className={inputClass}
                  placeholder="Husband's full name *"
                  maxLength={50}
                  value={form.husband_name}
                  onChange={(e) => setField("husband_name", e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Wife's full name *"
                  maxLength={50}
                  value={form.wife_name}
                  onChange={(e) => setField("wife_name", e.target.value)}
                />
                <input
                  className={`${inputClass} sm:col-span-2`}
                  placeholder="09XXXXXXXXX *"
                  maxLength={11}
                  value={form.contact_number}
                  onChange={(e) => handlePhone(e.target.value)}
                />
              </div>
            ) : (
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
            )}
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Residency</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    console.log("Walk-in residency: resident");
                    setIsResident(true);
                    setForm((prev) => ({
                      ...prev,
                      addr_street: "",
                      addr_barangay: "",
                      addr_city: "",
                      addr_province: "",
                      addr_zip: "",
                      addr_country: "Philippines",
                    }));
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
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Home address</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className={`${inputClass} bg-white sm:col-span-2`}
                    aria-label="House number, street, or purok"
                    placeholder="House no. / Street / Purok / Subdivision"
                    maxLength={150}
                    value={form.addr_street}
                    onChange={(e) => setField("addr_street", e.target.value)}
                  />
                  <input
                    className={`${inputClass} bg-white`}
                    aria-label="Barangay"
                    placeholder="Barangay *"
                    maxLength={100}
                    value={form.addr_barangay}
                    onChange={(e) => setField("addr_barangay", e.target.value)}
                  />
                  <input
                    className={`${inputClass} bg-white`}
                    aria-label="City or municipality"
                    placeholder="City / Municipality *"
                    maxLength={100}
                    value={form.addr_city}
                    onChange={(e) => setField("addr_city", e.target.value)}
                  />
                  <input
                    className={`${inputClass} bg-white`}
                    aria-label="Province"
                    placeholder="Province *"
                    maxLength={100}
                    value={form.addr_province}
                    onChange={(e) => setField("addr_province", e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className={`${inputClass} bg-white`}
                      aria-label="ZIP code"
                      placeholder="ZIP code"
                      inputMode="numeric"
                      maxLength={4}
                      value={form.addr_zip}
                      onChange={(e) => setField("addr_zip", e.target.value.replace(/\D/g, "").slice(0, 4))}
                    />
                    <input
                      className={`${inputClass} bg-white`}
                      aria-label="Country"
                      placeholder="Country *"
                      maxLength={60}
                      value={form.addr_country}
                      onChange={(e) => setField("addr_country", e.target.value)}
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Saved as:{" "}
                  <span className="font-medium text-slate-700">{composeAddress(form) || "—"}</span>
                </p>
              </div>
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
                  <p className="sm:col-span-2 text-xs text-slate-500">
                    Enter the details exactly as they should appear on the certificate.
                  </p>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Father&apos;s full name *</label>
                    <input
                      className={inputClass}
                      maxLength={150}
                      placeholder="e.g. John Meynard B. Wabe"
                      value={form.cert_father_name}
                      onChange={(e) => setField("cert_father_name", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Mother&apos;s full name *</label>
                    <input
                      className={inputClass}
                      maxLength={150}
                      placeholder="e.g. Clarisse Ann Lagumbay"
                      value={form.cert_mother_name}
                      onChange={(e) => setField("cert_mother_name", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Birth date *</label>
                    <input className={inputClass} type="date" value={form.birth_date} onChange={(e) => setField("birth_date", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Place of birth *</label>
                    <input
                      className={inputClass}
                      maxLength={150}
                      placeholder="e.g. Maria Reyna-Xavier University"
                      value={form.cert_birth_place}
                      onChange={(e) => setField("cert_birth_place", e.target.value)}
                    />
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
            {certNowActive ? (
              <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Clock size={20} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      Today · {formatTimeLabel(toHm(nowTick))} <span className="font-normal">(now)</span>
                    </p>
                    <p className="text-xs text-emerald-700">
                      Set automatically to the time of the visit. The exact time is recorded when you save.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={switchCertToManual}
                  className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  Change date / time
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ServiceDatePicker
                    ariaLabel="Date"
                    value={form.preferred_date}
                    onChange={handleDateChange}
                    blockFullyBooked={!isCertificate}
                    disabled={autoPicking}
                  />
                  <select
                    className={inputClass}
                    aria-label="Time"
                    value={form.preferred_time}
                    onChange={(e) => {
                      setField("preferred_time", e.target.value);
                      if (!isCertificate) setScheduleNote(null);
                    }}
                    disabled={!form.preferred_date || slotsLoading || autoPicking}
                  >
                    <option value="">{slotsLoading || autoPicking ? "Loading times…" : "Select time"}</option>
                    {timeChoices.map((opt) => (
                      <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                        {opt.display}
                      </option>
                    ))}
                  </select>
                </div>
                {autoPicking ? (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                    <Loader2 size={14} className="animate-spin" aria-hidden /> Finding the earliest open time…
                  </p>
                ) : scheduleNote ? (
                  <p
                    className={`mt-2 flex items-start gap-1.5 text-sm ${
                      form.preferred_time ? "text-emerald-700" : "text-amber-700"
                    }`}
                    role="status"
                  >
                    <Clock size={14} className="mt-0.5 shrink-0" aria-hidden /> {scheduleNote}
                  </p>
                ) : (
                  form.preferred_date &&
                  !hasOpenTime &&
                  !slotsLoading && (
                    <p className="text-sm text-amber-700 mt-2">No open time slots on this date.</p>
                  )
                )}
                {isCertificate && (
                  <button
                    type="button"
                    onClick={switchCertToNow}
                    className="mt-2 text-sm font-medium text-blue-700 hover:underline"
                  >
                    Use the current time instead
                  </button>
                )}
              </>
            )}
          </section>

          <div className="space-y-2">
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
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Info size={14} className="shrink-0" />
              {isCertificate
                ? "You can assign a priest (optional) before the booking is saved."
                : "You will assign a priest before the booking is saved."}
            </p>
          </div>
        </form>
      )}

      {priestModalOpen && selected && (
        <div className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="walkin-priest-title"
            className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 id="walkin-priest-title" className="text-lg font-semibold text-slate-900">
                  Assign Priest &amp; Save
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isCertificate
                    ? "Priest is optional for certificate requests."
                    : "A priest is required before this booking can be saved."}
                </p>
              </div>
              <ModalCloseButton onClick={closePriestModal} />
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Booking summary</p>
                <dl className="bg-slate-50 rounded-lg p-3 text-sm grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5">
                  <dt className="text-slate-500">{isCoupleBooking ? "Couple" : "Client"}</dt>
                  <dd className="font-medium text-slate-900 break-words">{summaryClientName || "—"}</dd>
                  <dt className="text-slate-500">Service</dt>
                  <dd className="font-medium text-slate-900">{selected.service_name || selected.service_type}</dd>
                  <dt className="text-slate-500">Date</dt>
                  <dd className="font-medium text-slate-900">{summaryDate}</dd>
                  <dt className="text-slate-500">Time</dt>
                  <dd className="font-medium text-slate-900">{summaryTime}</dd>
                  <dt className="text-slate-500">Fee</dt>
                  <dd className="font-medium text-slate-900">{formatFee(selected.fee)}</dd>
                </dl>
              </div>

              <div>
                <label htmlFor="walkin-priest" className="block text-sm font-medium text-slate-700 mb-1">
                  Select priest {isCertificate ? <span className="text-slate-400 font-normal">(optional)</span> : <span className="text-red-500">*</span>}
                </label>
                {priestsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    <span className="ml-2 text-sm text-slate-500">Loading priests…</span>
                  </div>
                ) : priests.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                    <p className="text-sm text-amber-700">
                      No available priests right now.
                      {isCertificate ? " You can still save this certificate without a priest." : " A priest must be available to save this booking."}
                    </p>
                    <button
                      type="button"
                      onClick={loadPriests}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Refresh list
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      id="walkin-priest"
                      value={selectedPriestId ?? ""}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : null;
                        console.log("[WalkIn] Priest selected:", id);
                        setSelectedPriestId(id);
                      }}
                      disabled={submitting}
                      className={`${inputClass} bg-white`}
                    >
                      <option value="">Select a priest…</option>
                      {priests.map((priest) => (
                        <option key={priest.user_id} value={priest.user_id}>
                          {getUserFullName(priest)}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">
                      Showing {priests.length} available priest{priests.length > 1 ? "s" : ""}
                    </p>
                  </>
                )}
              </div>

              {selectedPriest && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700 flex items-center gap-2">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>
                      {getUserFullName(selectedPriest)} will be assigned and notified. The booking is saved as approved and unpaid.
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3 px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={closePriestModal}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              {isCertificate && (
                <button
                  type="button"
                  onClick={() => saveBooking(null)}
                  disabled={submitting || priestsLoading}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50"
                >
                  Save without priest
                </button>
              )}
              <button
                type="button"
                onClick={() => saveBooking(selectedPriestId)}
                disabled={submitting || priestsLoading || !selectedPriestId}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Saving…
                  </>
                ) : (
                  "Assign & Save"
                )}
              </button>
            </div>
          </div>
        </div>
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
