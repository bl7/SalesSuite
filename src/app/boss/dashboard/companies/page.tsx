"use client";

import { useEffect, useState, useRef } from "react";

type Company = {
  id: string;
  name: string;
  status: string;
  plan: string;
  createdAt: string;
  address: string;
  subscriptionEndsAt: string | null;
  subscriptionSuspended: boolean;
  staffLimit: number;
  contactEmail: string | null;
  contactPhone: string | null;
  staff: { total: number; active: number; inactive: number; invited: number };
};

const PAGE_SIZES = [10, 20, 50];

export default function BossCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [subscriptionModal, setSubscriptionModal] = useState<{ company: Company } | null>(null);
  const [subMonths, setSubMonths] = useState(1);
  const [subNote, setSubNote] = useState("");
  const [subAmountNotes, setSubAmountNotes] = useState("");
  const [subKind, setSubKind] = useState<"payment" | "complimentary">("payment");
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [graceModal, setGraceModal] = useState<{ company: Company } | null>(null);
  const [graceDays, setGraceDays] = useState(3);
  const [graceKind, setGraceKind] = useState<"grace" | "complimentary">("grace");
  const [graceNote, setGraceNote] = useState("");
  const [graceLoading, setGraceLoading] = useState(false);
  const [graceError, setGraceError] = useState<string | null>(null);
  const [staffLimitModal, setStaffLimitModal] = useState<{ company: Company } | null>(null);
  const [staffLimitValue, setStaffLimitValue] = useState(5);
  const [staffLimitSaving, setStaffLimitSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<Company | null>(null);

  function load(opts?: { page?: number; limit?: number; q?: string }) {
    const p = opts?.page ?? page;
    const l = opts?.limit ?? limit;
    const q = opts?.q ?? search;
    const params = new URLSearchParams({ page: String(p), limit: String(l) });
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/boss/companies?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setCompanies(data.companies ?? []);
          setTotalCount(data.totalCount ?? 0);
          setPage(data.page ?? 1);
          setLimit(data.limit ?? 10);
        }
      });
  }

  // Live search: debounce so we fetch ~300ms after user stops typing
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
      searchDebounceRef.current = null;
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search.trim()) params.set("q", search.trim());
    fetch(`/api/boss/companies?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setCompanies(data.companies ?? []);
          setTotalCount(data.totalCount ?? 0);
          setPage(data.page ?? 1);
          setLimit(data.limit ?? 10);
        }
        setLoading(false);
      });
  }, [search, page, limit]);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const start = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, totalCount);

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  async function handleAddMonths(e: React.FormEvent) {
    if (!subscriptionModal) return;
    e.preventDefault();
    setSubLoading(true);
    setSubError(null);
    const res = await fetch(`/api/boss/companies/${subscriptionModal.company.id}/subscription`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "add_months", months: subMonths, note: subNote.trim() || undefined, amountNotes: subAmountNotes.trim() || undefined, kind: subKind }),
    });
    const data = await res.json();
    setSubLoading(false);
    if (!res.ok) { setSubError(data.error ?? "Failed"); return; }
    setSubscriptionModal(null);
    setSubMonths(1);
    setSubNote("");
    setSubAmountNotes("");
    setSubKind("payment");
    load();
  }

  async function handleAddDays(e: React.FormEvent) {
    if (!graceModal) return;
    e.preventDefault();
    setGraceLoading(true);
    setGraceError(null);
    const res = await fetch(`/api/boss/companies/${graceModal.company.id}/subscription`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "add_days", days: graceDays, note: graceNote.trim() || undefined, kind: graceKind }),
    });
    const data = await res.json();
    setGraceLoading(false);
    if (!res.ok) { setGraceError(data.error ?? "Failed"); return; }
    setGraceModal(null);
    setGraceDays(3);
    setGraceNote("");
    setGraceKind("grace");
    load();
  }

  async function handleOneMonthOnUs(company: Company) {
    setGraceError(null);
    const res = await fetch(`/api/boss/companies/${company.id}/subscription`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "add_months", months: 1, kind: "complimentary", note: "1 month on us" }),
    });
    if (!res.ok) { const d = await res.json(); setGraceError(d.error ?? "Failed"); return; }
    setGraceModal(null);
    load();
  }

  async function handleSuspend(company: Company) {
    setActionLoadingId(company.id);
    await fetch(`/api/boss/companies/${company.id}/subscription`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "suspend" }) });
    setActionLoadingId(null);
    load();
  }

  async function handleResume(company: Company) {
    setActionLoadingId(company.id);
    await fetch(`/api/boss/companies/${company.id}/subscription`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "resume" }) });
    setActionLoadingId(null);
    load();
  }

  async function handleSaveStaffLimit(e: React.FormEvent) {
    if (!staffLimitModal) return;
    e.preventDefault();
    setStaffLimitSaving(true);
    const res = await fetch(`/api/boss/companies/${staffLimitModal.company.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ staffLimit: staffLimitValue }),
    });
    setStaffLimitSaving(false);
    if (!res.ok) return;
    setStaffLimitModal(null);
    load();
  }

  function subStatus(c: Company) {
    if (c.subscriptionSuspended) return { label: "Suspended", type: "suspended" as const };
    if (!c.subscriptionEndsAt) return { label: "No subscription", type: "expired" as const };
    const end = new Date(c.subscriptionEndsAt);
    if (end < new Date()) return { label: "Expired", type: "expired" as const };
    return { label: end.toLocaleDateString(), type: "active" as const };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Companies</h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Subscription, plan (staff limit), and staff counts per company.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email…"
            className="w-56 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600"
          />
          {searchInput.trim() && (
            <button
              type="button"
              onClick={clearSearch}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium dark:border-zinc-700"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <label className="flex items-center gap-2">
            <span>Per page</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 h-48 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Company</th>
                <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Status</th>
                <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Subscription</th>
                <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Plan (staff limit)</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">Total</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">Active</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">Inactive</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">Invited</th>
                <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-zinc-500 dark:text-zinc-400">No companies yet.</td></tr>
              ) : (
                companies.map((c) => {
                  const sub = subStatus(c);
                  return (
                    <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800/80">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setDetailModal(c)}
                          className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-400"
                        >
                          {c.name}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${c.status === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"}`}>{c.status}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${sub.type === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : sub.type === "suspended" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"}`}>{sub.label}</span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => { setStaffLimitModal({ company: c }); setStaffLimitValue(c.staffLimit); }}
                          className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                        >
                          {c.staffLimit} staff + 1 manager
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.staff.total}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{c.staff.active}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{c.staff.inactive}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{c.staff.invited}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => setSubscriptionModal({ company: c })} disabled={!!actionLoadingId} className="rounded bg-zinc-200 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200">Add months</button>
                          <button type="button" onClick={() => setGraceModal({ company: c })} disabled={!!actionLoadingId} className="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-medium text-sky-800 dark:bg-sky-900/30 dark:text-sky-400">Add grace</button>
                          {!c.subscriptionSuspended ? (
                            <button type="button" onClick={() => handleSuspend(c)} disabled={actionLoadingId === c.id} className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Suspend</button>
                          ) : (
                            <button type="button" onClick={() => handleResume(c)} disabled={actionLoadingId === c.id} className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Resume</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && totalCount > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-zinc-200 pt-3 sm:flex-row dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Showing {start}–{end} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
            >
              Previous
            </button>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Company detail modal */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4" onClick={() => setDetailModal(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{detailModal.name}</h3>
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">Company details</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Email</dt>
                <dd className="mt-0.5 text-zinc-900 dark:text-zinc-100">{detailModal.contactEmail ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Phone</dt>
                <dd className="mt-0.5 text-zinc-900 dark:text-zinc-100">{detailModal.contactPhone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Address</dt>
                <dd className="mt-0.5 text-zinc-900 dark:text-zinc-100">{detailModal.address?.trim() || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Status</dt>
                <dd className="mt-0.5">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${detailModal.status === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"}`}>{detailModal.status}</span>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Subscription</dt>
                <dd className="mt-0.5">{subStatus(detailModal).label}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Plan</dt>
                <dd className="mt-0.5">{detailModal.staffLimit} staff + 1 manager</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Staff</dt>
                <dd className="mt-0.5">Total {detailModal.staff.total} — Active {detailModal.staff.active}, Inactive {detailModal.staff.inactive}, Invited {detailModal.staff.invited}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <button type="button" onClick={() => setDetailModal(null)} className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium dark:border-zinc-700">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add months modal */}
      {subscriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4" onClick={() => !subLoading && setSubscriptionModal(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Add subscription months</h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subscriptionModal.company.name}</p>
            <form onSubmit={handleAddMonths} className="mt-3 space-y-2">
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Record as</span>
                <div className="mt-0.5 flex gap-3">
                  <label className="flex items-center gap-1.5"><input type="radio" name="subKind" checked={subKind === "payment"} onChange={() => setSubKind("payment")} /><span className="text-xs">Payment</span></label>
                  <label className="flex items-center gap-1.5"><input type="radio" name="subKind" checked={subKind === "complimentary"} onChange={() => setSubKind("complimentary")} /><span className="text-xs">Complimentary</span></label>
                </div>
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Months</span>
                <input type="number" min={1} max={120} value={subMonths} onChange={(e) => setSubMonths(parseInt(e.target.value, 10) || 1)} className="mt-0.5 w-full rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
              </label>
              {subKind === "payment" && (
                <label className="block">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Amount (optional)</span>
                  <input type="text" value={subAmountNotes} onChange={(e) => setSubAmountNotes(e.target.value)} placeholder="e.g. NPR 15,000" className="mt-0.5 w-full rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
                </label>
              )}
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Note (optional)</span>
                <input type="text" value={subNote} onChange={(e) => setSubNote(e.target.value)} className="mt-0.5 w-full rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
              </label>
              {subError && <p className="text-xs text-red-600 dark:text-red-400">{subError}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setSubscriptionModal(null)} disabled={subLoading} className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium dark:border-zinc-700">Cancel</button>
                <button type="submit" disabled={subLoading} className="rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-200 dark:text-zinc-900">{subLoading ? "Saving…" : "Add months"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add grace modal */}
      {graceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4" onClick={() => !graceLoading && setGraceModal(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Add grace or complimentary</h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{graceModal.company.name}</p>
            <form onSubmit={handleAddDays} className="mt-3 space-y-2">
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Days</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {[3, 7, 14].map((d) => (
                    <button key={d} type="button" onClick={() => setGraceDays(d)} className={`rounded border px-2 py-1 text-xs font-medium ${graceDays === d ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900" : "border-zinc-200 dark:border-zinc-700"}`}>{d} days</button>
                  ))}
                  <input type="number" min={1} max={365} value={graceDays} onChange={(e) => setGraceDays(parseInt(e.target.value, 10) || 1)} className="w-14 rounded border border-zinc-200 px-1.5 py-1 text-center text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
                </div>
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Type</span>
                <div className="mt-0.5 flex gap-3">
                  <label className="flex items-center gap-1.5"><input type="radio" name="graceKind" checked={graceKind === "grace"} onChange={() => setGraceKind("grace")} /><span className="text-xs">Grace</span></label>
                  <label className="flex items-center gap-1.5"><input type="radio" name="graceKind" checked={graceKind === "complimentary"} onChange={() => setGraceKind("complimentary")} /><span className="text-xs">Complimentary</span></label>
                </div>
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Note (optional)</span>
                <input type="text" value={graceNote} onChange={(e) => setGraceNote(e.target.value)} className="mt-0.5 w-full rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
              </label>
              {graceError && <p className="text-xs text-red-600 dark:text-red-400">{graceError}</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="submit" disabled={graceLoading} className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white dark:bg-sky-500">Add days</button>
                <button type="button" onClick={() => handleOneMonthOnUs(graceModal.company)} disabled={graceLoading} className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium dark:border-zinc-700">Give 1 month on us</button>
                <button type="button" onClick={() => setGraceModal(null)} disabled={graceLoading} className="rounded px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff limit (plan) modal */}
      {staffLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4" onClick={() => !staffLimitSaving && setStaffLimitModal(null)}>
          <div className="w-full max-w-xs rounded-xl bg-white p-4 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Plan (staff limit)</h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{staffLimitModal.company.name} — 1 manager + this many staff allowed.</p>
            <form onSubmit={handleSaveStaffLimit} className="mt-3 space-y-2">
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Staff slots (reps, back office, etc.)</span>
                <input type="number" min={0} max={500} value={staffLimitValue} onChange={(e) => setStaffLimitValue(Math.max(0, parseInt(e.target.value, 10) || 0))} className="mt-0.5 w-full rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
              </label>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Total users allowed: {staffLimitValue + 1} (1 manager + {staffLimitValue} staff)</p>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setStaffLimitModal(null)} disabled={staffLimitSaving} className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium dark:border-zinc-700">Cancel</button>
                <button type="submit" disabled={staffLimitSaving} className="rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-200 dark:text-zinc-900">{staffLimitSaving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
