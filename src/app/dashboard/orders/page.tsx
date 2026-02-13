"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "../_lib/toast-context";
import { useSession } from "../_lib/session-context";

type OrderItem = {
  id: string;
  product_name: string;
  product_sku: string | null;
  quantity: string;
  unit_price: string;
  line_total: string;
  notes: string | null;
};

type Order = {
  id: string;
  order_number: string;
  status: "received" | "processing" | "shipped" | "closed" | "cancelled";
  notes: string | null;
  total_amount: string;
  currency_code: string;
  placed_at: string;
  processed_at: string | null;
  shipped_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  cancel_note: string | null;
  created_at: string;
  updated_at: string;
  shop_id: string | null;
  shop_name: string | null;
  shop_phone: string | null;
  shop_address: string | null;
  lead_name: string | null;
  placed_by_name: string | null;
  placed_by_company_user_id: string | null;
  items_count?: number;
  items: OrderItem[] | null;
};

type OrderDetail = Order & {
  shop_contact_name?: string | null;
  cancelled_by_name?: string | null;
};

type Shop = { id: string; name: string };
type Product = { id: string; name: string; sku: string; current_price: string | null; currency_code: string | null; unit: string };
type Rep = { company_user_id: string; full_name: string };

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  processing: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  shipped: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  closed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const CANCEL_REASONS = [
  "Customer requested",
  "Out of stock",
  "Duplicate order",
  "Wrong address",
  "Payment issue",
  "Other",
];

type MainTab = "active" | "shipped" | "closed" | "cancelled";
type SubTab = "received" | "processing";

const SORT_BY_TAB: Record<string, string> = {
  received: "placed_at_desc",
  processing: "placed_at_asc",
  shipped: "placed_at_asc",
  closed: "placed_at_desc",
  cancelled: "placed_at_desc",
};

function buildOrdersQuery(
  mainTab: MainTab,
  subTab: SubTab,
  filters: { q: string; dateFrom: string; dateTo: string; repId: string; shopId: string }
) {
  const status =
    mainTab === "active" ? subTab : mainTab;
  const sort = SORT_BY_TAB[status] ?? "placed_at_desc";
  const params = new URLSearchParams();
  params.set("status", status);
  params.set("sort", sort);
  if (filters.q) params.set("q", filters.q);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.repId) params.set("rep", filters.repId);
  if (filters.shopId) params.set("shop", filters.shopId);
  return params.toString();
}

export default function OrdersPage() {
  const session = useSession();
  const toast = useToast();
  const canChangeStatus = session.user.role === "boss" || session.user.role === "manager" || session.user.role === "back_office";
  const isRep = session.user.role === "rep";

  const [mainTab, setMainTab] = useState<MainTab>("active");
  const [subTab, setSubTab] = useState<SubTab>("received");
  const [filters, setFilters] = useState({ q: "", dateFrom: "", dateTo: "", repId: "", shopId: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState({ received: 0, processing: 0, shipped: 0, closed: 0, cancelled: 0 });
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [drawerOrder, setDrawerOrder] = useState<OrderDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cancelModal, setCancelModal] = useState<{ orderId: string; reason: string; note: string } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const statusForFetch = mainTab === "active" ? subTab : mainTab;

  const loadOrders = useCallback(async () => {
    const query = buildOrdersQuery(mainTab, subTab, appliedFilters);
    const res = await fetch(`/api/manager/orders?${query}`);
    const data = (await res.json()) as { ok: boolean; orders?: Order[]; error?: string };
    if (res.ok && data.ok) setOrders(data.orders ?? []);
    else toast.error(data.error ?? "Failed to load orders");
  }, [mainTab, subTab, appliedFilters, toast]);

  const loadCounts = useCallback(async () => {
    const res = await fetch("/api/manager/orders/counts");
    const data = (await res.json()) as { ok: boolean; counts?: typeof counts };
    if (res.ok && data.ok && data.counts) setCounts(data.counts);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      await loadOrders();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadOrders]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    if (drawerOrderId) {
      (async () => {
        const res = await fetch(`/api/manager/orders/${drawerOrderId}`);
        const data = (await res.json()) as { ok: boolean; order?: OrderDetail; error?: string };
        if (res.ok && data.order) setDrawerOrder(data.order);
        else setDrawerOrder(null);
      })();
    } else {
      setDrawerOrder(null);
    }
  }, [drawerOrderId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [shopsRes, productsRes, staffRes] = await Promise.all([
        fetch("/api/manager/shops"),
        fetch("/api/manager/products"),
        fetch("/api/manager/staff"),
      ]);
      if (cancelled) return;
      const shopsData = (await shopsRes.json()) as { shops?: Shop[] };
      const productsData = (await productsRes.json()) as { products?: Product[] };
      const staffData = (await staffRes.json()) as { ok: boolean; staff?: { company_user_id: string; full_name: string; role: string }[] };
      setShops(shopsData.shops ?? []);
      setProducts(productsData.products ?? []);
      setReps((staffData.staff ?? []).filter((s) => s.role === "rep").map((s) => ({ company_user_id: s.company_user_id, full_name: s.full_name })));
    })();
    return () => { cancelled = true; };
  }, []);

  const activeCount = counts.received + counts.processing;

  const transitionOrder = useCallback(
    async (orderId: string, nextStatus: "processing" | "shipped" | "closed") => {
      setWorking(true);
      const res = await fetch(`/api/manager/orders/${orderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      setWorking(false);
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Could not update order");
        return;
      }
      toast.success(nextStatus === "processing" ? "Order started processing." : nextStatus === "shipped" ? "Order marked shipped." : "Order closed.");
      setDrawerOrderId(null);
      await loadOrders();
      await loadCounts();
    },
    [toast, loadOrders, loadCounts]
  );

  const cancelOrder = useCallback(
    async (orderId: string, cancel_reason: string, cancel_note: string) => {
      setWorking(true);
      const res = await fetch(`/api/manager/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cancel_reason, cancel_note: cancel_note || undefined }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      setWorking(false);
      setCancelModal(null);
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Could not cancel order");
        return;
      }
      toast.success("Order cancelled.");
      setDrawerOrderId(null);
      await loadOrders();
      await loadCounts();
    },
    [toast, loadOrders, loadCounts]
  );

  const bulkTransition = useCallback(
    async (ids: string[], nextStatus: "processing" | "shipped" | "closed") => {
      setWorking(true);
      let ok = 0;
      for (const id of ids) {
        const res = await fetch(`/api/manager/orders/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (res.ok) ok++;
      }
      setWorking(false);
      setSelectedIds(new Set());
      toast.success(`${ok} order(s) updated.`);
      await loadOrders();
      await loadCounts();
    },
    [toast, loadOrders, loadCounts]
  );

  const bulkCancel = useCallback(
    async (ids: string[], reason: string) => {
      setWorking(true);
      let ok = 0;
      for (const id of ids) {
        const res = await fetch(`/api/manager/orders/${id}/cancel`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cancel_reason: reason }),
        });
        if (res.ok) ok++;
      }
      setWorking(false);
      setSelectedIds(new Set());
      toast.success(`${ok} order(s) cancelled.`);
      await loadOrders();
      await loadCounts();
    },
    [toast, loadOrders, loadCounts]
  );

  const exportCSV = useCallback((list: Order[]) => {
    const headers = ["Order ID", "Shop/Customer", "Rep", "Created", "Status", "Items", "Total", "Last updated"];
    const rows = list.map((o) => [
      o.order_number,
      o.shop_name || o.lead_name || "—",
      o.placed_by_name || "—",
      new Date(o.placed_at).toISOString(),
      o.status,
      o.items_count ?? (o.items?.length ?? 0),
      `${o.currency_code} ${Number(o.total_amount).toLocaleString()}`,
      new Date(o.updated_at).toISOString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${statusForFetch}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported.");
  }, [statusForFetch, toast]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === orders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(orders.map((o) => o.id)));
  };

  const selectedOrders = useMemo(() => orders.filter((o) => selectedIds.has(o.id)), [orders, selectedIds]);

  const inputClass =
    "rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Orders</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Process and track orders. Use tabs to work by status.
          </p>
        </div>
        {canChangeStatus && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + New Order
          </button>
        )}
      </div>

      {showCreateForm && canChangeStatus && (
        <NewOrderModal
          shops={shops}
          products={products}
          working={working}
          onClose={() => setShowCreateForm(false)}
          onSubmit={async (payload) => {
            setWorking(true);
            const res = await fetch("/api/manager/orders", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = (await res.json()) as { ok: boolean; error?: string };
            setWorking(false);
            if (!res.ok || !data.ok) {
              toast.error(data.error ?? "Could not create order");
              return;
            }
            toast.success("Order created.");
            setShowCreateForm(false);
            await loadOrders();
            await loadCounts();
          }}
        />
      )}

      {/* Tabs */}
      <div className="mb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-1">
          {(
            [
              { id: "active" as MainTab, label: "Active", count: activeCount },
              { id: "shipped" as MainTab, label: "Shipped", count: counts.shipped },
              { id: "closed" as MainTab, label: "Closed", count: counts.closed },
              { id: "cancelled" as MainTab, label: "Cancelled", count: counts.cancelled },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setMainTab(tab.id); setSelectedIds(new Set()); }}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                mainTab === tab.id
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        {mainTab === "active" && (
          <div className="mt-2 flex gap-2 pl-1">
            {(["received", "processing"] as const).map((st) => (
              <button
                key={st}
                onClick={() => { setSubTab(st); setSelectedIds(new Set()); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  subTab === st
                    ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {st === "received" ? "Received" : "Processing"} ({st === "received" ? counts.received : counts.processing})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search order ID, shop, rep…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && loadOrders()}
          className={`${inputClass} min-w-[200px]`}
        />
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          className={inputClass}
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          className={inputClass}
        />
        {!isRep && (
          <>
            <select
              value={filters.repId}
              onChange={(e) => setFilters((f) => ({ ...f, repId: e.target.value }))}
              className={inputClass}
            >
              <option value="">All reps</option>
              {reps.map((r) => (
                <option key={r.company_user_id} value={r.company_user_id}>{r.full_name}</option>
              ))}
            </select>
            <select
              value={filters.shopId}
              onChange={(e) => setFilters((f) => ({ ...f, shopId: e.target.value }))}
              className={inputClass}
            >
              <option value="">All shops</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </>
        )}
        <button
          type="button"
          onClick={() => setAppliedFilters(filters)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          Apply
        </button>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && canChangeStatus && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/50">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {selectedIds.size} selected
          </span>
          {mainTab === "active" && subTab === "received" && (
            <button
              disabled={working}
              onClick={() => bulkTransition(Array.from(selectedIds), "processing")}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Move to processing
            </button>
          )}
          {mainTab === "active" && subTab === "processing" && (
            <button
              disabled={working}
              onClick={() => bulkTransition(Array.from(selectedIds), "shipped")}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Mark shipped
            </button>
          )}
          {mainTab === "active" && (subTab === "received" || subTab === "processing") && (
            <button
              disabled={working}
              onClick={() => {
                const reason = window.prompt("Cancel reason (required):", CANCEL_REASONS[0]);
                if (reason) bulkCancel(Array.from(selectedIds), reason);
              }}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Cancel
            </button>
          )}
          {mainTab === "shipped" && (
            <button
              disabled={working}
              onClick={() => bulkTransition(Array.from(selectedIds), "closed")}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Close
            </button>
          )}
          <button type="button" onClick={() => exportCSV(selectedOrders)} className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
            Export CSV
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
            Print
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                {canChangeStatus && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && selectedIds.size === orders.length}
                      onChange={selectAll}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Order ID</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Shop / Customer</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Rep</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Created</th>
                {mainTab === "active" && (
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Status</th>
                )}
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Items</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Last updated</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setDrawerOrderId(o.id)}
                  className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
                >
                  {canChangeStatus && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(o.id)}
                        onChange={() => toggleSelect(o.id)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono font-medium text-zinc-900 dark:text-zinc-100">{o.order_number}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{o.shop_name || o.lead_name || "—"}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{o.placed_by_name ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{new Date(o.placed_at).toLocaleString()}</td>
                  {mainTab === "active" && (
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[o.status] ?? ""}`}>
                        {o.status}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{o.items_count ?? o.items?.length ?? 0}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {o.currency_code} {Number(o.total_amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{new Date(o.updated_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {canChangeStatus && o.status === "received" && (
                      <button
                        disabled={working}
                        onClick={(e) => { e.stopPropagation(); transitionOrder(o.id, "processing"); }}
                        className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        Start processing
                      </button>
                    )}
                    {canChangeStatus && o.status === "processing" && (
                      <button
                        disabled={working}
                        onClick={(e) => { e.stopPropagation(); transitionOrder(o.id, "shipped"); }}
                        className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        Mark shipped
                      </button>
                    )}
                    {canChangeStatus && o.status === "shipped" && (
                      <button
                        disabled={working}
                        onClick={(e) => { e.stopPropagation(); transitionOrder(o.id, "closed"); }}
                        className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        Close order
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && orders.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-zinc-400">
            No orders in this view. Adjust filters or create a new order.
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerOrderId && (
        <OrderDrawer
          orderId={drawerOrderId}
          order={drawerOrder}
          canChangeStatus={canChangeStatus}
          working={working}
          onClose={() => setDrawerOrderId(null)}
          onTransition={transitionOrder}
          onCancelClick={() => setCancelModal({ orderId: drawerOrderId, reason: CANCEL_REASONS[0], note: "" })}
          onExportCSV={() => {
            const o = drawerOrder || orders.find((x) => x.id === drawerOrderId);
            if (o) exportCSV([o]);
          }}
        />
      )}

      {/* Cancel modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Cancel order</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">This cannot be undone. Provide a reason (required).</p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Reason</label>
              <select
                value={cancelModal.reason}
                onChange={(e) => setCancelModal((m) => m ? { ...m, reason: e.target.value } : null)}
                className={inputClass}
              >
                {CANCEL_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Note (optional)</label>
              <textarea
                value={cancelModal.note}
                onChange={(e) => setCancelModal((m) => m ? { ...m, note: e.target.value } : null)}
                rows={2}
                className={inputClass}
                placeholder="Optional details…"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModal(null)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => cancelOrder(cancelModal.orderId, cancelModal.reason, cancelModal.note)}
                disabled={working}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Cancel order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderDrawer(props: {
  orderId: string;
  order: OrderDetail | null;
  canChangeStatus: boolean;
  working: boolean;
  onClose: () => void;
  onTransition: (id: string, status: "processing" | "shipped" | "closed") => void;
  onCancelClick: () => void;
  onExportCSV: () => void;
}) {
  const { orderId, order, canChangeStatus, working, onClose, onTransition, onCancelClick, onExportCSV } = props;

  if (!order) {
    return (
      <div className="fixed inset-y-0 right-0 z-40 w-full max-w-lg border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:max-w-xl">
        <div className="flex h-full flex-col p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Order</h2>
            <button onClick={onClose} className="rounded p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:text-zinc-400 dark:hover:bg-zinc-800">✕</button>
          </div>
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">Loading…</div>
        </div>
      </div>
    );
  }

  const shopLabel = order.shop_name || order.lead_name || "—";
  const timeline = [
    order.placed_at && { label: "Placed", at: order.placed_at },
    order.processed_at && { label: "Processing started", at: order.processed_at },
    order.shipped_at && { label: "Shipped", at: order.shipped_at },
    order.closed_at && { label: "Closed", at: order.closed_at },
    order.cancelled_at && { label: "Cancelled", at: order.cancelled_at, meta: order.cancel_reason },
  ].filter(Boolean) as { label: string; at: string; meta?: string | null }[];

  const primaryAction =
    order.status === "received"
      ? { label: "Start processing", status: "processing" as const }
      : order.status === "processing"
        ? { label: "Mark shipped", status: "shipped" as const }
        : order.status === "shipped"
          ? { label: "Close order", status: "closed" as const }
          : null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:max-w-xl">
      <div className="flex flex-col overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{order.order_number}</h2>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? ""}`}>
              {order.status}
            </span>
          </div>
          <button onClick={onClose} className="rounded p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:text-zinc-400 dark:hover:bg-zinc-800" aria-label="Close">✕</button>
        </div>

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Shop / Customer</h3>
          <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{shopLabel}</p>
          {order.shop_phone && <p className="text-sm text-zinc-600 dark:text-zinc-400">{order.shop_phone}</p>}
          {order.shop_address && <p className="text-sm text-zinc-600 dark:text-zinc-400">{order.shop_address}</p>}
        </section>

        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Rep</h3>
          <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{order.placed_by_name ?? "—"}</p>
        </section>

        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Line items</h3>
          <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-400">Item</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Price</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.items ?? []).map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100">{item.product_name}</td>
                    <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{Number(item.quantity)}</td>
                    <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{Number(item.unit_price).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-100">{Number(item.line_total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Total: {order.currency_code} {Number(order.total_amount).toLocaleString()}
          </p>
        </section>

        {order.notes && (
          <section className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Notes</h3>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{order.notes}</p>
          </section>
        )}

        <section className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Status timeline</h3>
          <ul className="mt-2 space-y-1.5">
            {timeline.map((t) => (
              <li key={t.at} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{t.label}</span>
                <span>{new Date(t.at).toLocaleString()}</span>
                {t.meta && <span className="text-zinc-500">({t.meta})</span>}
              </li>
            ))}
          </ul>
        </section>

        {order.status === "cancelled" && order.cancelled_by_name && (
          <section className="mt-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Cancelled by {order.cancelled_by_name}
              {order.cancel_note && ` — ${order.cancel_note}`}
            </p>
          </section>
        )}

        <div className="mt-8 flex flex-wrap gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          {primaryAction && canChangeStatus && (
            <button
              disabled={working}
              onClick={() => onTransition(orderId, primaryAction.status)}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {primaryAction.label}
            </button>
          )}
          <button
            onClick={onExportCSV}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Print
          </button>
          {(order.status === "received" || order.status === "processing") && canChangeStatus && (
            <button
              onClick={onCancelClick}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Cancel order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Create order form (unchanged) ── */

type LineItem = {
  key: number;
  productId: string;
  productName: string;
  productSku: string;
  quantity: string;
  unitPrice: string;
};

function NewOrderModal(props: {
  shops: Shop[];
  products: Product[];
  working: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    shopId?: string;
    notes?: string;
    currencyCode: string;
    items: { productId?: string; productName: string; productSku?: string; quantity: number; unitPrice: number }[];
  }) => Promise<void>;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 overflow-y-auto"
      onClick={props.onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-order-title"
    >
      <div
        className="my-8 w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="new-order-title" className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          New Order
        </h2>
        <CreateOrderForm
          shops={props.shops}
          products={props.products}
          disabled={props.working}
          submitLabel={props.working ? "Placing order…" : "Place Order"}
          onSubmit={async (payload) => {
            await props.onSubmit(payload);
            props.onClose();
          }}
        />
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateOrderForm(props: {
  shops: Shop[];
  products: Product[];
  disabled: boolean;
  submitLabel?: string;
  onSubmit: (payload: {
    shopId?: string;
    notes?: string;
    currencyCode: string;
    items: { productId?: string; productName: string; productSku?: string; quantity: number; unitPrice: number }[];
  }) => Promise<void>;
}) {
  const [shopId, setShopId] = useState("");
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState("NPR");
  const [items, setItems] = useState<LineItem[]>([
    { key: 1, productId: "", productName: "", productSku: "", quantity: "1", unitPrice: "0" },
  ]);

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

  function addItem() {
    setItems([...items, { key: Date.now(), productId: "", productName: "", productSku: "", quantity: "1", unitPrice: "0" }]);
  }

  function removeItem(key: number) {
    if (items.length <= 1) return;
    setItems(items.filter((i) => i.key !== key));
  }

  function updateItem(key: number, field: keyof LineItem, value: string) {
    setItems(items.map((i) => {
      if (i.key !== key) return i;
      const updated = { ...i, [field]: value };
      if (field === "productId" && value) {
        const p = props.products.find((pr) => pr.id === value);
        if (p) {
          updated.productName = p.name;
          updated.productSku = p.sku;
          updated.unitPrice = p.current_price ?? "0";
        }
      }
      return updated;
    }));
  }

  const total = items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const orderItems = items.map((i) => ({
          productId: i.productId || undefined,
          productName: i.productName,
          productSku: i.productSku || undefined,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        }));
        await props.onSubmit({
          shopId: shopId || undefined,
          notes: notes || undefined,
          currencyCode: currency,
          items: orderItems,
        });
        setShopId("");
        setNotes("");
        setItems([{ key: Date.now(), productId: "", productName: "", productSku: "", quantity: "1", unitPrice: "0" }]);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Shop / Customer</label>
          <select value={shopId} onChange={(e) => setShopId(e.target.value)} className={inputClass}>
            <option value="">Select shop (optional)</option>
            {props.shops.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Links the order to a location for reporting.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
            <option value="NPR">NPR</option>
            <option value="USD">USD</option>
            <option value="INR">INR</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={inputClass} />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Items</p>
        {items.map((item) => (
          <div key={item.key} className="grid grid-cols-[1fr_1fr_80px_100px_32px] gap-2 items-end">
            <select value={item.productId} onChange={(e) => updateItem(item.key, "productId", e.target.value)} className={inputClass}>
              <option value="">Select product…</option>
              {props.products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
            <input required value={item.productName} onChange={(e) => updateItem(item.key, "productName", e.target.value)} placeholder="Product name" className={inputClass} />
            <input required type="number" min={1} step="any" value={item.quantity} onChange={(e) => updateItem(item.key, "quantity", e.target.value)} placeholder="Qty" className={inputClass} />
            <input required type="number" min={0} step="0.01" value={item.unitPrice} onChange={(e) => updateItem(item.key, "unitPrice", e.target.value)} placeholder="Price" className={inputClass} />
            <button type="button" onClick={() => removeItem(item.key)} className="flex h-[42px] items-center justify-center rounded-lg text-zinc-400 hover:text-red-500" title="Remove item">✕</button>
          </div>
        ))}
        <button type="button" onClick={addItem} className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">+ Add another item</button>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Total: {currency} {total.toLocaleString()}</p>
        <button disabled={props.disabled} type="submit" className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
          {props.submitLabel ?? "Place Order"}
        </button>
      </div>
    </form>
  );
}
