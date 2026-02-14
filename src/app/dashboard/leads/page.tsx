"use client";

import { useEffect, useState } from "react";
import { useToast } from "../_lib/toast-context";

type Lead = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  notes: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  shop_name: string | null;
  assigned_rep_name: string | null;
  shop_id?: string | null;
  assigned_rep_company_user_id?: string | null;
};

type Shop = { id: string; name: string };
type Staff = { company_user_id: string; full_name: string; role: string };

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  contacted: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  qualified: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  converted: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  lost: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const NEXT_STATUS: Record<string, string> = {
  new: "contacted",
  contacted: "qualified",
  qualified: "converted",
};

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500";

export default function LeadsPage() {
  const toast = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [reps, setReps] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  async function loadLeads(status = filterStatus, q = search) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const res = await fetch(`/api/manager/leads?${params}`);
    const data = (await res.json()) as { ok: boolean; leads?: Lead[]; error?: string };
    if (res.ok && data.ok) setLeads(data.leads ?? []);
    else toast.error(data.error ?? "Failed to load leads");
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [leadsRes, shopsRes, staffRes] = await Promise.all([
        fetch("/api/manager/leads"),
        fetch("/api/manager/shops"),
        fetch("/api/manager/staff"),
      ]);
      const leadsData = (await leadsRes.json()) as { ok: boolean; leads?: Lead[] };
      const shopsData = (await shopsRes.json()) as { shops?: Shop[] };
      const staffData = (await staffRes.json()) as { ok: boolean; staff?: Staff[] };
      if (cancelled) return;
      if (leadsRes.ok && leadsData.ok) setLeads(leadsData.leads ?? []);
      else toast.error((leadsData as { error?: string }).error ?? "Failed to load leads");
      setShops(shopsData.shops ?? []);
      setReps((staffData.staff ?? []).filter((s) => s.role === "rep"));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function onCreate(payload: {
    shopId?: string;
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    assignedRepCompanyUserId?: string;
    notes?: string;
  }) {
    setWorking(true);
    const res = await fetch("/api/manager/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not create lead");
      return;
    }
    toast.success("Lead created.");
    setAddModalOpen(false);
    await loadLeads();
  }

  async function onUpdate(leadId: string, payload: Record<string, unknown>) {
    setWorking(true);
    const res = await fetch(`/api/manager/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not update lead");
      return;
    }
    toast.success("Lead updated.");
    setEditingLead(null);
    await loadLeads();
  }

  async function onDelete(leadId: string) {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    setWorking(true);
    const res = await fetch(`/api/manager/leads/${leadId}`, { method: "DELETE" });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not delete lead");
      return;
    }
    toast.success("Lead deleted.");
    await loadLeads();
  }

  async function onConvertToShop(l: Lead) {
    setWorking(true);
    const res = await fetch(`/api/manager/leads/${l.id}/convert-to-shop`, {
      method: "POST",
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      shop?: { id: string; name: string };
      message?: string;
    };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not convert lead to shop");
      return;
    }
    toast.success(
      data.shop
        ? `"${data.shop.name}" created. You can now place orders for this shop.`
        : data.message ?? "Lead converted to shop."
    );
    await loadLeads();
  }

  function handleFilter(status: string) {
    setFilterStatus(status);
    loadLeads(status, search);
  }

  function handleSearch(q: string) {
    setSearch(q);
    loadLeads(filterStatus, q);
  }

  const selectClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Leads</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Track and manage sales leads from the field.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + New Lead
        </button>
      </div>

      {addModalOpen && (
        <AddLeadModal
          shops={shops}
          reps={reps}
          working={working}
          onClose={() => setAddModalOpen(false)}
          onSubmit={onCreate}
        />
      )}

      {editingLead && (
        <EditLeadModal
          lead={editingLead}
          shops={shops}
          reps={reps}
          working={working}
          onClose={() => setEditingLead(null)}
          onSave={(payload) => onUpdate(editingLead.id, payload)}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={filterStatus} onChange={(e) => handleFilter(e.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, contact, or phone…"
          className="max-w-xs rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Name</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Contact</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Shop</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Assigned Rep</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{l.name}</p>
                    {l.contact_name && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{l.contact_name}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400">
                    {l.phone && <p className="text-xs">{l.phone}</p>}
                    {l.email && <p className="text-xs">{l.email}</p>}
                    {!l.phone && !l.email && <span className="text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400">{l.shop_name ?? "—"}</td>
                  <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400">{l.assigned_rep_name ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[l.status] ?? ""}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {l.status !== "converted" && l.status !== "lost" && (
                        <button
                          type="button"
                          onClick={() => onConvertToShop(l)}
                          disabled={working}
                          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                        >
                          Convert to shop
                        </button>
                      )}
                      {NEXT_STATUS[l.status] && NEXT_STATUS[l.status] !== "converted" && (
                        <button
                          type="button"
                          onClick={() => onUpdate(l.id, { status: NEXT_STATUS[l.status] })}
                          disabled={working}
                          className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          → {NEXT_STATUS[l.status]}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingLead(l)}
                        className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(l.id)}
                        disabled={working}
                        className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800/40 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!leads.length && (
            <div className="px-5 py-10 text-center text-sm text-zinc-400">
              No leads yet. Click &quot;+ New Lead&quot; to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModalShell(props: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      onClick={props.onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title" className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {props.title}
        </h2>
        {props.children}
      </div>
    </div>
  );
}

function AddLeadModal(props: {
  shops: Shop[];
  reps: Staff[];
  working: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    shopId?: string;
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    assignedRepCompanyUserId?: string;
    notes?: string;
  }) => Promise<void>;
}) {
  const [shopId, setShopId] = useState("");
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [assignedRepId, setAssignedRepId] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await props.onSubmit({
      shopId: shopId || undefined,
      name,
      contactName: contactName || undefined,
      phone: phone || undefined,
      email: email || undefined,
      address: address || undefined,
      assignedRepCompanyUserId: assignedRepId || undefined,
      notes: notes || undefined,
    });
    setShopId("");
    setName("");
    setContactName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setAssignedRepId("");
    setNotes("");
    props.onClose();
  }

  return (
    <ModalShell title="New Lead" onClose={props.onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Lead name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Lead name" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Contact name</label>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} placeholder="Optional" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="Optional" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="Optional" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Shop</label>
            <select value={shopId} onChange={(e) => setShopId(e.target.value)} className={inputClass}>
              <option value="">Select shop (optional)</option>
              {props.shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Assign to rep</label>
            <select value={assignedRepId} onChange={(e) => setAssignedRepId(e.target.value)} className={inputClass}>
              <option value="">Optional</option>
              {props.reps.map((r) => (
                <option key={r.company_user_id} value={r.company_user_id}>{r.full_name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="Optional" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} placeholder="Optional" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={props.onClose} className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
            Cancel
          </button>
          <button type="submit" disabled={props.working} className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
            {props.working ? "Creating…" : "Create Lead"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function EditLeadModal(props: {
  lead: Lead;
  shops: Shop[];
  reps: Staff[];
  working: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const l = props.lead;
  const [name, setName] = useState(l.name);
  const [contactName, setContactName] = useState(l.contact_name ?? "");
  const [phone, setPhone] = useState(l.phone ?? "");
  const [email, setEmail] = useState(l.email ?? "");
  const [address, setAddress] = useState(l.address ?? "");
  const [status, setStatus] = useState(l.status);
  const [shopId, setShopId] = useState(
    l.shop_id ?? (l.shop_name ? (props.shops.find((s) => s.name === l.shop_name)?.id ?? "") : "")
  );
  const [assignedRepId, setAssignedRepId] = useState(
    l.assigned_rep_company_user_id ?? (l.assigned_rep_name ? (props.reps.find((r) => r.full_name === l.assigned_rep_name)?.company_user_id ?? "") : "")
  );
  const [notes, setNotes] = useState(l.notes ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await props.onSave({
      name,
      contactName: contactName || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      shopId: shopId || null,
      assignedRepCompanyUserId: assignedRepId || null,
      status,
      notes: notes || null,
    });
    props.onClose();
  }

  return (
    <ModalShell title="Edit Lead" onClose={props.onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Contact name</label>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Shop</label>
            <select value={shopId} onChange={(e) => setShopId(e.target.value)} className={inputClass}>
              <option value="">No shop</option>
              {props.shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Assigned rep</label>
            <select value={assignedRepId} onChange={(e) => setAssignedRepId(e.target.value)} className={inputClass}>
              <option value="">No rep</option>
              {props.reps.map((r) => (
                <option key={r.company_user_id} value={r.company_user_id}>{r.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Lead["status"])} className={inputClass}>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={props.onClose} className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
            Cancel
          </button>
          <button type="submit" disabled={props.working} className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
            {props.working ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
