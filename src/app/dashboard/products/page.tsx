"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "../_lib/session-context";
import { useToast } from "../_lib/toast-context";

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  is_active: boolean;
  current_price: string | null;
  currency_code: string | null;
  created_at: string;
  updated_at: string;
  order_count?: number;
};

type ProductListResponse = { ok: boolean; error?: string; products?: Product[] };

type Tab = "active" | "inactive";

function formatUpdatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function ProductsPage() {
  const session = useSession();
  const toast = useToast();
  const canManageProducts =
    session.user.role === "boss" ||
    session.user.role === "manager" ||
    session.user.role === "back_office";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [tab, setTab] = useState<Tab>("active");
  const [searchInput, setSearchInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<Product | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  const debouncedQ = useDebounce(searchInput.trim(), 300);

  const loadProducts = useCallback(
    async (status: Tab, q: string) => {
      const params = new URLSearchParams();
      params.set("status", status);
      if (q) params.set("q", q);
      const res = await fetch(`/api/manager/products?${params.toString()}`);
      const data = (await res.json()) as ProductListResponse;
      if (res.ok && data.ok) setProducts(data.products ?? []);
      else toast.error(data.error ?? "Failed to load products");
    },
    [toast]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadProducts(tab, debouncedQ).then(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, debouncedQ, loadProducts]);

  useLayoutEffect(() => {
    if (!menuOpenId || !menuRef.current) {
      setDropdownPosition(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    const menuHeight = 180;
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

  const openAdd = () => {
    setEditingProduct(null);
    setDuplicateFrom(null);
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setDuplicateFrom(null);
    setShowModal(true);
  };

  const openDuplicate = (p: Product) => {
    setMenuOpenId(null);
    setEditingProduct(null);
    setDuplicateFrom(p);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setDuplicateFrom(null);
  };

  const refresh = () => loadProducts(tab, debouncedQ);

  async function onCreate(payload: {
    sku: string;
    name: string;
    description?: string;
    unit: string;
    price?: number;
    currencyCode: string;
    status?: "active" | "inactive";
  }) {
    setWorking(true);
    const res = await fetch("/api/manager/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        status: payload.status ?? "active",
      }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not create product");
      return data.error;
    }
    toast.success("Product added.");
    closeModal();
    refresh();
  }

  async function onUpdate(
    productId: string,
    payload: Record<string, unknown> & { status?: "active" | "inactive" }
  ) {
    setWorking(true);
    const body: Record<string, unknown> = { ...payload };
    if (payload.status !== undefined) body.isActive = payload.status === "active";
    const res = await fetch(`/api/manager/products/${productId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not update product");
      return data.error;
    }
    toast.success("Product updated.");
    closeModal();
    refresh();
  }

  async function onSetPrice(
    productId: string,
    price: number,
    currencyCode: string
  ) {
    const res = await fetch(`/api/manager/products/${productId}/prices`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ price, currencyCode }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not update price");
      return data.error;
    }
  }

  async function setStatus(productId: string, active: boolean) {
    setMenuOpenId(null);
    setWorking(true);
    const res = await fetch(`/api/manager/products/${productId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: active }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not update status");
      return;
    }
    toast.success(active ? "Product activated." : "Product deactivated.");
    refresh();
  }

  async function onDelete(productId: string) {
    setMenuOpenId(null);
    if (!confirm("Delete this product? This cannot be undone.")) return;
    setWorking(true);
    const res = await fetch(`/api/manager/products/${productId}`, {
      method: "DELETE",
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setWorking(false);
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Could not delete product");
      return;
    }
    toast.success("Product deleted.");
    refresh();
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(products.map((p) => p.id)));
  };

  const selectedList = products.filter((p) => selectedIds.has(p.id));

  async function bulkSetStatus(active: boolean) {
    setWorking(true);
    let done = 0;
    for (const p of selectedList) {
      const res = await fetch(`/api/manager/products/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: active }),
      });
      if (res.ok) done++;
    }
    setWorking(false);
    setSelectedIds(new Set());
    toast.success(
      done === selectedList.length
        ? `${done} product(s) ${active ? "activated" : "deactivated"}.`
        : `${done}/${selectedList.length} updated.`
    );
    refresh();
  }

  function bulkExportCsv() {
    const headers = ["Product", "SKU", "Unit", "Price", "Currency", "Status"];
    const rows = selectedList.map((p) => [
      p.name,
      p.sku,
      p.unit,
      p.current_price ?? "",
      p.currency_code ?? "NPR",
      p.is_active ? "active" : "inactive",
    ]);
    const csv =
      headers.join(",") +
      "\n" +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setSelectedIds(new Set());
    toast.success("Export downloaded.");
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Products
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage your product catalog.
          </p>
        </div>
        {canManageProducts && (
          <button
            onClick={openAdd}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + Add Product
          </button>
        )}
      </div>

      {/* Tabs + Search */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-zinc-200 bg-zinc-50/50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800/50">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === "active"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setTab("inactive")}
            className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === "inactive"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            Inactive
          </button>
        </div>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or SKU…"
          className="w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
      </div>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {selectedIds.size} selected
          </span>
          {canManageProducts && (
            <>
              {tab === "active" && (
                <button
                  type="button"
                  onClick={() => bulkSetStatus(false)}
                  disabled={working}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Bulk Deactivate
                </button>
              )}
              {tab === "inactive" && (
                <button
                  type="button"
                  onClick={() => bulkSetStatus(true)}
                  disabled={working}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Bulk Activate
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={bulkExportCsv}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Bulk Export CSV
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-400"
          >
            Clear selection
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60"
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                {canManageProducts && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        products.length > 0 &&
                        selectedIds.size === products.length
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
                      aria-label="Select all"
                    />
                  </th>
                )}
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Product
                </th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  SKU
                </th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Unit
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Price
                </th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Updated
                </th>
                <th className="w-28 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  {canManageProducts && (
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
                        aria-label={`Select ${p.name}`}
                      />
                    </td>
                  )}
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {p.name}
                      </p>
                      {p.description && (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {p.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {p.sku}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400">
                    {p.unit}
                  </td>
                  <td className="px-5 py-3.5 text-right text-zinc-900 dark:text-zinc-100">
                    {p.current_price
                      ? `${p.currency_code ?? "NPR"} ${Number(p.current_price).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        p.is_active
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {p.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">
                    {formatUpdatedAt(p.updated_at)}
                  </td>
                  <td className="px-4 py-3.5">
                    {canManageProducts && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          Edit
                        </button>
                        <div className="relative" ref={menuOpenId === p.id ? menuRef : null}>
                          <button
                            type="button"
                            onClick={() =>
                              setMenuOpenId((id) => (id === p.id ? null : p.id))
                            }
                            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                            aria-label="More actions"
                            aria-expanded={menuOpenId === p.id}
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
          {!products.length && (
            <div className="px-5 py-10 text-center text-sm text-zinc-400">
              {tab === "active"
                ? "No active products. Add one or switch to Inactive."
                : "No inactive products."}
            </div>
          )}
        </div>
      )}

      {menuOpenId && dropdownPosition && typeof document !== "undefined" &&
        createPortal(
          (() => {
            const p = products.find((x) => x.id === menuOpenId);
            if (!p) return null;
            return (
              <div
                ref={dropdownRef}
                className="min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                style={{
                  position: "fixed",
                  zIndex: 50,
                  ...dropdownPosition,
                }}
              >
                <button
                  type="button"
                  onClick={() => setStatus(p.id, !p.is_active)}
                  className="w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {p.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => openDuplicate(p)}
                  className="w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Duplicate
                </button>
                {(p.order_count ?? 0) === 0 ? (
                  <button
                    type="button"
                    onClick={() => onDelete(p.id)}
                    disabled={working}
                    className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Delete
                  </button>
                ) : (
                  <span
                    className="block px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500"
                    title="Cannot delete products used in orders"
                  >
                    Delete (used in orders)
                  </span>
                )}
              </div>
            );
          })(),
          document.body
        )}

      {showModal && (
        <ProductModal
          product={editingProduct}
          duplicateFrom={duplicateFrom}
          working={working}
          onClose={closeModal}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onSetPrice={onSetPrice}
        />
      )}
    </div>
  );
}

/* ── Modal: Add / Edit (minimal: name, sku, unit, price, status) ── */

function ProductModal(props: {
  product: Product | null;
  duplicateFrom: Product | null;
  working: boolean;
  onClose: () => void;
  onCreate: (payload: {
    sku: string;
    name: string;
    description?: string;
    unit: string;
    price?: number;
    currencyCode: string;
    status?: "active" | "inactive";
  }) => Promise<string | undefined>;
  onUpdate: (
    id: string,
    payload: Record<string, unknown> & { status?: "active" | "inactive" }
  ) => Promise<string | undefined>;
  onSetPrice: (
    productId: string,
    price: number,
    currencyCode: string
  ) => Promise<string | undefined>;
}) {
  const isEdit = !!props.product;
  const prefill = props.duplicateFrom ?? props.product;
  const [name, setName] = useState(prefill?.name ?? "");
  const [sku, setSku] = useState(
    props.duplicateFrom ? "" : prefill?.sku ?? ""
  );
  const [unit, setUnit] = useState(prefill?.unit ?? "unit");
  const [price, setPrice] = useState(
    prefill?.current_price ? String(prefill.current_price) : ""
  );
  const [currencyCode, setCurrencyCode] = useState(
    prefill?.currency_code ?? "NPR"
  );
  const [status, setStatus] = useState<"active" | "inactive">(
    prefill ? (prefill.is_active ? "active" : "inactive") : "active"
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (isEdit && props.product) {
      const err = await props.onUpdate(props.product.id, {
        name,
        sku,
        unit,
        status,
      });
      if (err) setServerError(err);
      if (price && Number(price) >= 0) {
        const priceErr = await props.onSetPrice(
          props.product.id,
          Number(price),
          currencyCode
        );
        if (priceErr) setServerError(priceErr);
      }
    } else {
      const err = await props.onCreate({
        sku,
        name,
        unit,
        price: price ? Number(price) : undefined,
        currencyCode,
        status,
      });
      if (err) setServerError(err);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      onClick={props.onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="product-modal-title"
          className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          {isEdit ? "Edit Product" : props.duplicateFrom ? "Duplicate Product" : "Add Product"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {serverError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
              {serverError}
            </p>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Product name"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              SKU
            </label>
            <input
              required
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className={inputClass}
              placeholder="SKU"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Unit
            </label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className={inputClass}
              placeholder="e.g. unit, kg, box"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Price (optional)
            </label>
            <div className="flex gap-2">
              <select
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className={`${inputClass} w-24`}
              >
                <option value="NPR">NPR</option>
                <option value="USD">USD</option>
                <option value="INR">INR</option>
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Status
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "active" | "inactive")
              }
              className={inputClass}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={props.working}
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {props.working ? "Saving…" : isEdit ? "Save" : "Add Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
