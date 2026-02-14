"use client";

import { useEffect, useState } from "react";
import type { Shop, ShopListResponse } from "../_lib/types";
import type { StaffListResponse } from "../_lib/types";
import { useSession } from "../_lib/session-context";
import { useToast } from "../_lib/toast-context";

type Rep = { company_user_id: string; full_name: string };

export default function ShopsPage() {
  const session = useSession();
  const toast = useToast();
  const canAssignRep =
    session.user.role === "boss" ||
    session.user.role === "manager" ||
    session.user.role === "back_office";
  const canAddShop = session.user.role === "boss" || session.user.role === "manager";

  const [shops, setShops] = useState<Shop[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [assignShop, setAssignShop] = useState<Shop | null>(null);

  async function loadShops() {
    const res = await fetch("/api/manager/shops");
    const data = (await res.json()) as ShopListResponse;
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Failed to load shops");
      return;
    }
    setShops(data.shops ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [shopsRes, staffRes] = await Promise.all([
        fetch("/api/manager/shops"),
        ...(canAssignRep ? [fetch("/api/manager/staff")] : [Promise.resolve(null)]),
      ]);
      if (cancelled) return;
      const shopsData = (await shopsRes.json()) as ShopListResponse;
      if (shopsRes.ok && shopsData.ok) setShops(shopsData.shops ?? []);
      else toast.error((shopsData as { error?: string }).error ?? "Failed to load shops");
      if (canAssignRep && staffRes) {
        const staffData = (await (staffRes as Response).json()) as StaffListResponse;
        if (staffData.ok && staffData.staff)
          setReps(
            staffData.staff
              .filter((s) => s.role === "rep" && s.status === "active")
              .map((s) => ({ company_user_id: s.company_user_id, full_name: s.full_name }))
          );
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [canAssignRep]);

  async function onAdd(payload: {
    name: string;
    latitude: number;
    longitude: number;
    geofenceRadiusM: number;
  }) {
    setWorking(true);
    const res = await fetch("/api/manager/shops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not create shop");
      return;
    }
    toast.success("Shop added.");
    setShowForm(false);
    await loadShops();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Shops</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage shop locations and geofencing for visit verification.
          </p>
        </div>
        {canAddShop && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + Add Shop
          </button>
        )}
      </div>

      {showForm && (
        <AddShopModal
          onClose={() => setShowForm(false)}
          onSubmit={onAdd}
          working={working}
        />
      )}

      {assignShop && (
        <AssignRepModal
          shop={assignShop}
          reps={reps}
          onClose={() => setAssignShop(null)}
          onSuccess={() => {
            setAssignShop(null);
            loadShops();
          }}
          toast={toast}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Name</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Location</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Radius</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Reps Assigned</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 dark:text-zinc-400">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
                        </svg>
                      </div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400">
                    {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400">{s.geofence_radius_m}m</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">{s.assignment_count}</span>
                      {canAssignRep && (
                        <button
                          type="button"
                          onClick={() => setAssignShop(s)}
                          className="text-xs font-medium text-zinc-500 underline decoration-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:decoration-zinc-600 dark:hover:text-zinc-300"
                        >
                          {s.assignment_count === 0 ? "Assign rep" : "Add rep"}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      s.is_active
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}>
                      {s.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shops.length && (
            <div className="px-5 py-10 text-center text-sm text-zinc-400">
              {canAddShop ? "No shops yet. Click \"+ Add Shop\" to get started." : "No shops yet."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500";

function AddShopModal(props: {
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    latitude: number;
    longitude: number;
    geofenceRadiusM: number;
  }) => Promise<void>;
  working: boolean;
}) {
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [geofenceRadiusM, setGeofenceRadiusM] = useState("60");
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await props.onSubmit({
      name,
      latitude: Number(latitude),
      longitude: Number(longitude),
      geofenceRadiusM: Number(geofenceRadiusM),
    });
    setName("");
    setLatitude("");
    setLongitude("");
    setGeofenceRadiusM("60");
    props.onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      onClick={props.onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-shop-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-shop-title" className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Add Shop
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Shop name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Shop name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Latitude</label>
              <input required type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} className={inputClass} placeholder="Latitude" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Longitude</label>
              <input required type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} className={inputClass} placeholder="Longitude" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Geofence radius (m)</label>
            <input required type="number" min={1} value={geofenceRadiusM} onChange={(e) => setGeofenceRadiusM(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={props.onClose} className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
              Cancel
            </button>
            <button type="submit" disabled={props.working} className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
              {props.working ? "Adding…" : "Add Shop"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignRepModal(props: {
  shop: Shop;
  reps: Rep[];
  onClose: () => void;
  onSuccess: () => void;
  toast: { success: (msg: string) => void; error: (msg: string) => void };
}) {
  const [repId, setRepId] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [working, setWorking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repId) {
      props.toast.error("Select a rep");
      return;
    }
    setWorking(true);
    const res = await fetch("/api/manager/shop-assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shopId: props.shop.id,
        repCompanyUserId: repId,
        isPrimary,
      }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      props.toast.error(data.error ?? "Could not assign rep");
      return;
    }
    props.toast.success("Rep assigned.");
    props.onSuccess();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      onClick={props.onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-rep-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="assign-rep-title" className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Assign rep to {props.shop.name}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Rep</label>
            <select
              required
              value={repId}
              onChange={(e) => setRepId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select rep</option>
              {props.reps.map((r) => (
                <option key={r.company_user_id} value={r.company_user_id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Primary rep for this shop</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={props.onClose} className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
              Cancel
            </button>
            <button type="submit" disabled={working} className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
              {working ? "Assigning…" : "Assign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

