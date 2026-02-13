"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Staff,
  StaffListResponse,
  Shop,
  ShopListResponse,
  ShopAssignment,
  ShopAssignmentListResponse,
} from "../_lib/types";
import { useToast } from "../_lib/toast-context";

export default function AssignmentsPage() {
  const toast = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [assignments, setAssignments] = useState<ShopAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const reps = useMemo(
    () => staff.filter((s) => s.role === "rep" && s.status === "active"),
    [staff]
  );

  async function loadData() {
    const [sRes, shRes, aRes] = await Promise.all([
      fetch("/api/manager/staff"),
      fetch("/api/manager/shops"),
      fetch("/api/manager/shop-assignments"),
    ]);
    const sData = (await sRes.json()) as StaffListResponse;
    const shData = (await shRes.json()) as ShopListResponse;
    const aData = (await aRes.json()) as ShopAssignmentListResponse;
    setStaff(sData.staff ?? []);
    setShops(shData.shops ?? []);
    setAssignments(aData.assignments ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sRes, shRes, aRes] = await Promise.all([
        fetch("/api/manager/staff"),
        fetch("/api/manager/shops"),
        fetch("/api/manager/shop-assignments"),
      ]);
      const sData = (await sRes.json()) as StaffListResponse;
      const shData = (await shRes.json()) as ShopListResponse;
      const aData = (await aRes.json()) as ShopAssignmentListResponse;
      if (cancelled) return;
      if (sRes.ok && sData.ok) setStaff(sData.staff ?? []);
      else toast.error(sData.error ?? "Failed to load staff");
      if (shRes.ok && shData.ok) setShops(shData.shops ?? []);
      else toast.error(shData.error ?? "Failed to load shops");
      if (aRes.ok && aData.ok) setAssignments(aData.assignments ?? []);
      else toast.error(aData.error ?? "Failed to load assignments");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const repsWithShops = useMemo(
    () =>
      reps
        .map((rep) => {
          const repAssignments = assignments.filter(
            (a) => a.rep_company_user_id === rep.company_user_id
          );
          const repShops = repAssignments
            .map((a) => {
              const shop = shops.find((s) => s.id === a.shop_id);
              if (!shop) return null;
              return { shop, isPrimary: a.is_primary };
            })
            .filter(
              (
                value
              ): value is {
                shop: Shop;
                isPrimary: boolean;
              } => value !== null
            );

          return { rep, shops: repShops };
        })
        .filter((entry) => entry.shops.length > 0),
    [reps, shops, assignments]
  );

  async function onAssign(payload: { shopId: string; repCompanyUserId: string; isPrimary: boolean }) {
    setWorking(true);
    const res = await fetch("/api/manager/shop-assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not assign shop");
      return;
    }
    toast.success("Shop assigned to rep.");
    setAddModalOpen(false);
    await loadData();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Assignments</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Assign shops to reps for visit tracking and order capture.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + Add assignment
        </button>
      </div>

      {addModalOpen && (
        <AddAssignmentModal
          shops={shops}
          reps={reps}
          working={working}
          onClose={() => setAddModalOpen(false)}
          onSubmit={onAssign}
        />
      )}

      {/* Reps with assigned shops */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {repsWithShops.map((entry) => (
            <div
              key={entry.rep.company_user_id}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-zinc-500 dark:text-zinc-400"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M7 21v-2a4 4 0 0 1 3-3.87" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {entry.rep.full_name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {entry.shops.length}{" "}
                    {entry.shops.length === 1 ? "shop assigned" : "shops assigned"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {entry.shops.map(({ shop, isPrimary }) => (
                  <span
                    key={shop.id}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    {shop.name}
                    {isPrimary && (
                      <span className="text-[0.7rem] font-semibold text-amber-500">
                        Primary
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {repsWithShops.length === 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
              No assignments yet. Click &quot;+ Add assignment&quot; to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500";

function AddAssignmentModal(props: {
  shops: Shop[];
  reps: Staff[];
  working: boolean;
  onClose: () => void;
  onSubmit: (payload: { shopId: string; repCompanyUserId: string; isPrimary: boolean }) => Promise<void>;
}) {
  const [shopId, setShopId] = useState("");
  const [repCompanyUserId, setRepCompanyUserId] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shopId || !repCompanyUserId) return;
    await props.onSubmit({ shopId, repCompanyUserId, isPrimary });
    setShopId("");
    setRepCompanyUserId("");
    setIsPrimary(true);
    props.onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      onClick={props.onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-assignment-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-assignment-title" className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Add assignment
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Shop</label>
            <select required value={shopId} onChange={(e) => setShopId(e.target.value)} className={inputClass}>
              <option value="">Select shop</option>
              {props.shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Rep</label>
            <select required value={repCompanyUserId} onChange={(e) => setRepCompanyUserId(e.target.value)} className={inputClass}>
              <option value="">Select rep</option>
              {props.reps.map((r) => (
                <option key={r.company_user_id} value={r.company_user_id}>{r.full_name}</option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
            />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Primary rep for this shop</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={props.onClose} className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
              Cancel
            </button>
            <button type="submit" disabled={props.working} className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
              {props.working ? "Assigning…" : "Assign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

