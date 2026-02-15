"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "./_lib/session-context";
import type { Staff, StaffListResponse, Shop, ShopListResponse } from "./_lib/types";

type Order = {
  id: string;
  order_number: string;
  status: "received" | "processing" | "shipped" | "closed" | "cancelled";
  total_amount: string;
  currency_code: string;
  placed_at: string;
  shop_name: string | null;
};

type Lead = {
  id: string;
  name: string;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  contact_name: string | null;
  phone: string | null;
  created_at: string;
  shop_name: string | null;
};

export default function OverviewPage() {
  const session = useSession();
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sRes, shRes, oRes, lRes] = await Promise.all([
        fetch("/api/manager/staff"),
        fetch("/api/manager/shops"),
        fetch("/api/manager/orders"),
        fetch("/api/manager/leads"),
      ]);
      const sData = (await sRes.json()) as StaffListResponse;
      const shData = (await shRes.json()) as ShopListResponse;
      const oData = (await oRes.json()) as { ok: boolean; orders?: Order[] };
      const lData = (await lRes.json()) as { ok: boolean; leads?: Lead[] };
      if (cancelled) return;
      setStaff(sData.staff ?? []);
      setShops(shData.shops ?? []);
      setOrders(oData.orders ?? []);
      setLeads(lData.leads ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const activeReps = staff.filter((s) => s.role === "rep" && s.status === "active").length;
  const totalAssignments = shops.reduce((sum, s) => sum + s.assignment_count, 0);

  // Order stats
  const totalOrders = orders.length;
  const ordersReceived = orders.filter((o) => o.status === "received").length;
  const ordersProcessing = orders.filter((o) => o.status === "processing").length;
  const ordersShipped = orders.filter((o) => o.status === "shipped").length;
  const ordersClosed = orders.filter((o) => o.status === "closed").length;
  const ordersCancelled = orders.filter((o) => o.status === "cancelled").length;
  const recentOrders = orders.slice(0, 5);

  // Staff performance stats
  const activeStaff = staff.filter((s) => s.status === "active").length;
  const managers = staff.filter((s) => s.role === "manager").length;
  const backOffice = staff.filter((s) => s.role === "back_office").length;

  // Lead stats
  const newLeads = leads.filter((l) => l.status === "new").length;
  const recentLeads = leads.filter((l) => l.status === "new" || l.status === "contacted").slice(0, 5);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Welcome back, {session.user.fullName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Here&apos;s what&apos;s happening with {session.company.name}.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[106px] animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />
          ))}
        </div>
      ) : (
        <>
          {/* Top row: Key metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active Reps" value={activeReps} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            } />
            <StatCard label="Total Staff" value={staff.length} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            } />
            <StatCard label="New Leads" value={newLeads} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
              </svg>
            } />
            <StatCard label="Orders Today" value={ordersReceived + ordersProcessing} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            } />
          </div>

          {/* Second row: Staff performance */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active Staff" value={activeStaff} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              </svg>
            } />
            <StatCard label="Managers" value={managers} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            } />
            <StatCard label="Back Office" value={backOffice} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            } />
            <StatCard label="Shops Assigned" value={totalAssignments} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
                <path d="M9 22V12h6v10" />
              </svg>
            } />
          </div>
        </>
      )}

      {/* Recent activity */}
      {!loading && (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {/* New Leads */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                New Leads
              </h2>
              <Link href="/dashboard/leads" className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                View all →
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {recentLeads.length > 0 ? (
                recentLeads.map((l) => (
                  <div key={l.id} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {l.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{l.name}</p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {l.contact_name || l.phone || "No contact"}
                      </p>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {l.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-400">No new leads.</p>
              )}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Recent Orders
              </h2>
              <Link href="/dashboard/orders" className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                View all →
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {recentOrders.length > 0 ? (
                recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs font-mono font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {o.order_number.slice(-4)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{o.order_number}</p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {o.shop_name || "No shop"} · {new Date(o.placed_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {o.currency_code} {Number(o.total_amount).toLocaleString()}
                      </p>
                      <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        o.status === "received" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        o.status === "processing" ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                        o.status === "shipped" ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" :
                        o.status === "cancelled" ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      }`}>
                        {o.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-400">No orders yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order status breakdown */}
      {!loading && totalOrders > 0 && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Order Status Breakdown
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="text-center">
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{ordersReceived}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Received</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{ordersProcessing}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Processing</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{ordersShipped}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Shipped</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{ordersClosed}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Closed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{ordersCancelled}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Cancelled</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, suffix }: { label: string; value: number | string; icon: React.ReactNode; suffix?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix && <span className="ml-1 text-lg text-zinc-500 dark:text-zinc-400">{suffix}</span>}
      </p>
    </div>
  );
}
