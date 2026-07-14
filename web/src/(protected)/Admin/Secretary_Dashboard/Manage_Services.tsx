import React, { useCallback, useEffect, useState } from "react";
import {
  churchServiceAPI,
  formatFee,
  type ChurchService,
} from "../../../../library/church_service";
import { Layers, Plus } from "lucide-react";

const ICON_OPTIONS = [
  "Church",
  "Home",
  "Heart",
  "Cross",
  "Droplets",
  "BookOpen",
  "FileText",
  "Star",
  "Users",
  "Candle",
];

const emptyForm = {
  service_type: "",
  description: "",
  icon: "Church",
  category: "service" as "service" | "certificate",
  fee: "",
  available_slots: "10",
  is_active: true,
};

const ManageServices: React.FC = () => {
  const [rows, setRows] = useState<ChurchService[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ChurchService | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Secretary fetching church services...");
      const res = await churchServiceAPI.getAdminAll({ per_page: 100, search: search || undefined });
      if (res.data?.success) {
        const data = res.data.data;
        setRows(Array.isArray(data) ? data : data?.data || []);
      }
    } catch (err) {
      console.error(err);
      setFeedback("Failed to load services.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (row: ChurchService) => {
    setEditing(row);
    setForm({
      service_type: row.service_type || row.service_name || "",
      description: row.description || "",
      icon: row.icon || "Church",
      category: (row.category as "service" | "certificate") || "service",
      fee: String(row.fee ?? ""),
      available_slots: String(row.available_slots ?? row.daily_limit ?? 10),
      is_active: row.is_active !== false,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.service_type.trim() || !form.fee || !form.available_slots) {
      setFeedback("Name, fee, and daily request limit are required.");
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = {
        service_type: form.service_type.trim(),
        description: form.description.trim() || undefined,
        icon: form.icon,
        category: form.category,
        fee: Number(form.fee),
        available_slots: Number(form.available_slots),
        is_active: form.is_active,
      };
      console.log("Saving church service:", payload);
      const res = editing
        ? await churchServiceAPI.update(editing.service_id, payload)
        : await churchServiceAPI.create(payload);

      if (res.data?.success) {
        setShowModal(false);
        setFeedback(res.data.message || "Service saved.");
        fetchRows();
      } else {
        setFeedback(res.data?.message || "Failed to save service.");
      }
    } catch (err: any) {
      console.error(err);
      setFeedback(err?.response?.data?.message || "Failed to save service.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (row: ChurchService) => {
    try {
      const next = !(row.is_active !== false);
      console.log("Toggling service active:", row.service_id, next);
      await churchServiceAPI.update(row.service_id, { is_active: next });
      fetchRows();
    } catch (err: any) {
      console.error(err);
      setFeedback(err?.response?.data?.message || "Failed to update status.");
    }
  };

  const handleDelete = async (row: ChurchService) => {
    const label = row.is_system || (row as any).requests_count > 0 ? "deactivate" : "delete";
    if (!window.confirm(`${label === "deactivate" ? "Deactivate" : "Delete"} "${row.service_type || row.service_name}"?`)) {
      return;
    }
    try {
      const res = await churchServiceAPI.delete(row.service_id);
      setFeedback(res.data?.message || "Done.");
      fetchRows();
    } catch (err: any) {
      console.error(err);
      setFeedback(err?.response?.data?.message || "Failed to remove service.");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
            <Layers size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Manage Services</h1>
            <p className="text-sm text-slate-500 mt-1">
              Add church offerings that parishioners can request in the mobile app
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold"
        >
          <Plus size={16} /> Add Service
        </button>
      </div>

      {feedback && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 text-blue-800 text-sm">{feedback}</div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services..."
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white flex-1 max-w-xs"
        />
        <button onClick={fetchRows} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-slate-500">No services found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3">Service</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-left px-4 py-3">Fee</th>
                  <th className="text-left px-4 py-3">Daily limit</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.service_id} className={row.is_active === false ? "opacity-60" : ""}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{row.service_type || row.service_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {row.description || "No description"}
                      </p>
                      {row.is_system && (
                        <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          SYSTEM
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize">{row.category || "service"}</td>
                    <td className="px-4 py-3 font-semibold">{formatFee(row.fee)}</td>
                    <td className="px-4 py-3">{row.available_slots ?? row.daily_limit ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          row.is_active !== false
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.is_active !== false ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openEdit(row)}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(row)}
                          className="text-xs font-semibold text-amber-700 hover:underline"
                        >
                          {row.is_active !== false ? "Deactivate" : "Activate"}
                        </button>
                        {!row.is_system && (
                          <button
                            onClick={() => handleDelete(row)}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {editing ? "Edit Service" : "Add Service"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Service name *</label>
                <input
                  value={form.service_type}
                  onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="e.g. Car Blessing"
                  disabled={!!editing?.is_system}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Shown on the parishioner app card"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as "service" | "certificate" })
                    }
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    disabled={!!editing?.is_system}
                  >
                    <option value="service">Service</option>
                    <option value="certificate">Certificate</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Icon</label>
                  <select
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    {ICON_OPTIONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Fee (₱) *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.fee}
                    onChange={(e) => setForm({ ...form, fee: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Daily request limit *</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.available_slots}
                    onChange={(e) => setForm({ ...form, available_slots: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active (visible in parishioner app)
              </label>
              {!editing && (
                <p className="text-xs text-slate-500">
                  New services use the standard request form (name, contact, schedule).
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Service"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageServices;
