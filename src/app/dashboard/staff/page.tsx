"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Staff, StaffCounts, StaffListResponse } from "../_lib/types";
import { useSession } from "../_lib/session-context";
import { useToast } from "../_lib/toast-context";

type Tab = "active" | "invited" | "inactive";

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "rep", label: "Rep" },
  { value: "manager", label: "Manager" },
  { value: "back_office", label: "Back office" },
  { value: "boss", label: "Admin" },
] as const;

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  return (name[0] ?? "?").toUpperCase();
}

function formatLastLogin(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function normalizePhoneInput(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+977${digits}`;
  if (digits.length === 13 && digits.startsWith("977")) return `+${digits}`;
  if (digits.length >= 10) return `+977${digits.slice(-10)}`;
  return phone;
}

export default function StaffPage() {
  const session = useSession();
  const toast = useToast();
  const canManage = session.user.role === "boss" || session.user.role === "manager";
  const [staff, setStaff] = useState<Staff[]>([]);
  const [counts, setCounts] = useState<StaffCounts>({ active: 0, invited: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [tab, setTab] = useState<Tab>("active");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [deactivateStaff, setDeactivateStaff] = useState<Staff | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  const debouncedQ = useDebounce(searchInput.trim(), 300);
  const debouncedRole = useDebounce(roleFilter, 0);

  const loadStaff = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("status", tab);
    if (debouncedQ) params.set("q", debouncedQ);
    if (debouncedRole) params.set("role", debouncedRole);
    const res = await fetch(`/api/manager/staff?${params.toString()}`);
    const data = (await res.json()) as StaffListResponse;
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Failed to load staff");
      return;
    }
    setStaff(data.staff ?? []);
    if (data.counts) setCounts(data.counts);
  }, [tab, debouncedQ, debouncedRole, toast]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadStaff().then(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadStaff]);

  useLayoutEffect(() => {
    if (!menuOpenId || !menuRef.current) {
      setDropdownPosition(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    const menuHeight = 220;
    if (rect.bottom + menuHeight > window.innerHeight - 8 && rect.top > menuHeight) {
      setDropdownPosition({ bottom: window.innerHeight - rect.top + 4, right });
    } else {
      setDropdownPosition({ top: rect.bottom + 4, right });
    }
  }, [menuOpenId]);

  useEffect(() => {
    if (!menuOpenId) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setMenuOpenId(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpenId]);

  async function handleAdd(payload: { fullName: string; email: string; phone: string; role: string }) {
    setWorking(true);
    const phone = normalizePhoneInput(payload.phone);
    const res = await fetch("/api/manager/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: payload.fullName,
        email: payload.email,
        phone,
        role: payload.role === "boss" ? "manager" : payload.role,
      }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not add staff");
      return data.error;
    }
    toast.success(`Invite sent to ${payload.email}`);
    setAddDrawerOpen(false);
    loadStaff();
  }

  async function handleUpdate(id: string, payload: { fullName?: string; email?: string; phone?: string; role?: string }) {
    setWorking(true);
    const body: Record<string, unknown> = {};
    if (payload.fullName !== undefined) body.fullName = payload.fullName;
    if (payload.email !== undefined) body.email = payload.email;
    if (payload.role !== undefined) body.role = payload.role === "boss" ? "manager" : payload.role;
    if (payload.phone !== undefined) body.phone = normalizePhoneInput(payload.phone);

    const res = await fetch(`/api/manager/staff/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not update staff");
      return data.error;
    }
    toast.success("Staff updated.");
    setEditStaff(null);
    loadStaff();
  }

  async function handleResendInvite(s: Staff) {
    setMenuOpenId(null);
    setWorking(true);
    const res = await fetch(`/api/manager/staff/${s.company_user_id}/resend-invite`, { method: "POST" });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not resend invite");
      return;
    }
    toast.success(`Invite resent to ${s.email}`);
    loadStaff();
  }

  async function handleDeactivate(s: Staff, reassignToId?: string) {
    setMenuOpenId(null);
    setDeactivateStaff(null);
    setWorking(true);
    const res = await fetch(`/api/manager/staff/${s.company_user_id}/deactivate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(reassignToId ? { reassign_to_staff_id: reassignToId } : {}),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not deactivate");
      return;
    }
    toast.success("Staff deactivated.");
    loadStaff();
  }

  async function handleActivate(s: Staff) {
    setMenuOpenId(null);
    setWorking(true);
    const res = await fetch(`/api/manager/staff/${s.company_user_id}/activate`, { method: "POST" });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not activate");
      return;
    }
    toast.success("Staff activated.");
    loadStaff();
  }

  const [activeReps, setActiveReps] = useState<Staff[]>([]);
  useEffect(() => {
    if (!deactivateStaff) return;
    const params = new URLSearchParams({ status: "active", role: "rep" });
    fetch(`/api/manager/staff?${params}`)
      .then((r) => r.json())
      .then((d: StaffListResponse) => {
        if (d.ok && d.staff) setActiveReps(d.staff.filter((s) => s.company_user_id !== deactivateStaff?.company_user_id));
      });
  }, [deactivateStaff]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Staff</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage reps and back office users.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setAddDrawerOpen(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + Add staff
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-zinc-200 bg-zinc-50/50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800/50">
          {(["active", "invited", "inactive"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)} ({counts[t] ?? 0})
            </button>
          ))}
        </div>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, email, or phone…"
          className="w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {roleFilter && (
          <button
            type="button"
            onClick={() => setRoleFilter("")}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-400"
          >
            Reset filters
          </button>
        )}
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
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Email</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Phone</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Role</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Status</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Last login</th>
                <th className="w-28 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.company_user_id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {initials(s.full_name)}
                      </div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{s.full_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400">{s.email}</td>
                  <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400">{s.phone ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {s.role === "back_office" ? "Back office" : s.role === "boss" ? "Admin" : s.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        s.status === "active"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : s.status === "invited"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">
                    {formatLastLogin(s.last_login_at)}
                  </td>
                  <td className="px-4 py-3.5">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditStaff(s)}
                          className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          Edit
                        </button>
                        <div className="relative" ref={menuOpenId === s.company_user_id ? menuRef : null}>
                          <button
                            type="button"
                            onClick={() => setMenuOpenId((id) => (id === s.company_user_id ? null : s.company_user_id))}
                            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                            aria-label="More actions"
                            aria-expanded={menuOpenId === s.company_user_id}
                          >
                            <span className="text-base leading-none">⋯</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!staff.length && (
            <div className="px-5 py-10 text-center text-sm text-zinc-400">
              {tab === "active"
                ? "No active staff. Add someone or check Invited / Inactive."
                : `No ${tab} staff.`}
            </div>
          )}
        </div>
      )}

      {menuOpenId && dropdownPosition && typeof document !== "undefined" &&
        createPortal(
          (() => {
            const s = staff.find((x) => x.company_user_id === menuOpenId);
            if (!s) return null;
            return (
              <div
                ref={dropdownRef}
                className="min-w-[180px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                style={{
                  position: "fixed",
                  zIndex: 50,
                  ...dropdownPosition,
                }}
              >
                <button
                  type="button"
                  onClick={() => setEditStaff(s)}
                  className="w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Edit details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpenId(null);
                    setEditStaff({ ...s });
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Change role
                </button>
                {(s.status === "invited" || !s.email_verified_at) && (
                  <button
                    type="button"
                    onClick={() => handleResendInvite(s)}
                    disabled={working}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    Resend invite
                  </button>
                )}
                {(s.status === "active" || s.status === "invited") && (
                  <button
                    type="button"
                    onClick={() => {
                      if (s.role === "rep" && (s.assigned_shops_count ?? 0) > 0) {
                        setDeactivateStaff(s);
                      } else {
                        handleDeactivate(s);
                      }
                    }}
                    disabled={working}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    Deactivate
                  </button>
                )}
                {s.status === "inactive" && (
                  <button
                    type="button"
                    onClick={() => handleActivate(s)}
                    disabled={working}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    Activate
                  </button>
                )}
              </div>
            );
          })(),
          document.body
        )}

      {addDrawerOpen && (
        <AddStaffModal
          onClose={() => setAddDrawerOpen(false)}
          onSubmit={handleAdd}
          working={working}
        />
      )}

      {editStaff && (
        <EditStaffModal
          staff={editStaff}
          onClose={() => setEditStaff(null)}
          onSubmit={(payload) => handleUpdate(editStaff.company_user_id, payload)}
          working={working}
        />
      )}

      {deactivateStaff && (
        <DeactivateModal
          staff={deactivateStaff}
          activeReps={activeReps}
          onClose={() => setDeactivateStaff(null)}
          onConfirm={(reassignToId) => handleDeactivate(deactivateStaff, reassignToId)}
          working={working}
        />
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500";

function AddStaffModal(props: {
  onClose: () => void;
  onSubmit: (p: { fullName: string; email: string; phone: string; role: string }) => Promise<string | undefined>;
  working: boolean;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("rep");
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const err = await props.onSubmit({ fullName, email, phone, role });
    if (err) setServerError(err);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      onClick={props.onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-staff-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-staff-title" className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Add staff
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {serverError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
              {serverError}
            </p>
          )}
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            We&apos;ll generate a password and email login details to this address.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Full name</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Full name" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="email@example.com" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Phone</label>
            <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").slice(0, 14))} className={inputClass} placeholder="+977 98XXXXXXXX" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as "rep" | "manager" | "back_office")} className={inputClass}>
              <option value="rep">Rep</option>
              <option value="manager">Manager</option>
              <option value="back_office">Back office</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={props.onClose} className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
              Cancel
            </button>
            <button type="submit" disabled={props.working} className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
              {props.working ? "Sending…" : "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditStaffModal(props: {
  staff: Staff;
  onClose: () => void;
  onSubmit: (p: { fullName?: string; email?: string; phone?: string; role?: string }) => Promise<string | undefined>;
  working: boolean;
}) {
  const [fullName, setFullName] = useState(props.staff.full_name);
  const [email, setEmail] = useState(props.staff.email);
  const [phone, setPhone] = useState(props.staff.phone ?? "");
  const [role, setRole] = useState(props.staff.role === "boss" ? "manager" : props.staff.role);
  const [serverError, setServerError] = useState<string | null>(null);
  const emailChanged = email !== props.staff.email;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const err = await props.onSubmit({ fullName, email, phone, role });
    if (err) setServerError(err);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      onClick={props.onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-staff-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="edit-staff-title" className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Edit staff
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {serverError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
              {serverError}
            </p>
          )}
          {emailChanged && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200">
              This will change their login email.
            </p>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Full name</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Phone</label>
            <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").slice(0, 14))} className={inputClass} placeholder="+977 98XXXXXXXX" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as "rep" | "manager" | "back_office")} className={inputClass}>
              <option value="rep">Rep</option>
              <option value="manager">Manager</option>
              <option value="back_office">Back office</option>
            </select>
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
      </div>
    </div>
  );
}

function DeactivateModal(props: {
  staff: Staff;
  activeReps: Staff[];
  onClose: () => void;
  onConfirm: (reassignToId?: string) => void;
  working: boolean;
}) {
  const [reassignToId, setReassignToId] = useState("");
  const count = props.staff.assigned_shops_count ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="deactivate-title">
      <div className="absolute inset-0 bg-zinc-900/40" onClick={props.onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <h2 id="deactivate-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Deactivate rep
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This rep has {count} assigned shop{count !== 1 ? "s" : ""}. Reassign before deactivating.
        </p>
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Reassign to
          </label>
          {props.activeReps.length === 0 ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              No other active reps. Activate another rep first, then try again.
            </p>
          ) : (
            <select
              value={reassignToId}
              onChange={(e) => setReassignToId(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select a rep</option>
              {props.activeReps.map((r) => (
                <option key={r.company_user_id} value={r.company_user_id}>
                  {r.full_name} ({r.email})
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => props.onConfirm(reassignToId || undefined)}
            disabled={props.working || (props.activeReps.length === 0 || !reassignToId)}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {props.working ? "Updating…" : "Reassign and deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}
