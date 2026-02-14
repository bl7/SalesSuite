"use client";

import { useEffect, useState } from "react";
import { useBossSession } from "../_lib/boss-session-context";

type Boss = { id: string; email: string; fullName: string; createdAt: string };

export default function BossBossesPage() {
  const currentBoss = useBossSession();
  const [bosses, setBosses] = useState<Boss[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editBoss, setEditBoss] = useState<Boss | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteBoss, setDeleteBoss] = useState<Boss | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function load() {
    fetch("/api/boss/bosses")
      .then((r) => r.json())
      .then((data) => { if (data.ok) setBosses(data.bosses ?? []); });
  }

  useEffect(() => {
    setLoading(true);
    fetch("/api/boss/bosses")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setBosses(data.bosses ?? []);
        setLoading(false);
      });
  }, []);

  function openEdit(b: Boss) {
    setEditBoss(b);
    setEditEmail(b.email);
    setEditFullName(b.fullName ?? "");
    setEditNewPassword("");
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editBoss) return;
    setEditSaving(true);
    setEditError(null);
    const body: { email?: string; fullName?: string; newPassword?: string } = {
      email: editEmail.trim(),
      fullName: editFullName.trim() || undefined,
    };
    if (editBoss.id === currentBoss.id && editNewPassword.trim()) body.newPassword = editNewPassword.trim();
    const res = await fetch(`/api/boss/bosses/${editBoss.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setEditSaving(false);
    if (!res.ok) {
      setEditError(data.error ?? "Failed to update");
      return;
    }
    setEditBoss(null);
    load();
  }

  async function handleDelete() {
    if (!deleteBoss) return;
    setDeleteSaving(true);
    setDeleteError(null);
    const res = await fetch(`/api/boss/bosses/${deleteBoss.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeleteSaving(false);
    if (!res.ok) {
      setDeleteError(data.error ?? "Failed to delete");
      return;
    }
    setDeleteBoss(null);
    load();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/boss/bosses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password, fullName: fullName.trim() || undefined }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to add boss"); return; }
    setAddOpen(false);
    setEmail("");
    setPassword("");
    setFullName("");
    load();
  }

  function initials(b: Boss) {
    const name = (b.fullName || b.email || "").trim();
    if (!name) return "?";
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0]! + parts[parts.length - 1]![0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Team</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Platform admins who can sign in at <span className="font-mono text-xs">/boss/login</span> and manage companies.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + Add boss
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-3 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      ) : bosses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">No bosses yet</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Add the first platform admin to get started.</p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + Add boss
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {bosses.map((b) => (
            <li
              key={b.id || b.email}
              className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                {initials(b)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{b.fullName || b.email}</span>
                  {b.id === currentBoss.id && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">You</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">{b.email}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(b)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Edit
                </button>
                {b.id !== currentBoss.id && (
                  <button
                    type="button"
                    onClick={() => { setDeleteBoss(b); setDeleteError(null); }}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm" onClick={() => !saving && setAddOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Add boss</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">They’ll sign in at <span className="font-mono text-xs">/boss/login</span>.</p>
            <form onSubmit={handleAdd} className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Email</span>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-600" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Password (min 8)</span>
                <input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-600" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Name (optional)</span>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600" />
              </label>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setAddOpen(false)} disabled={saving} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">{saving ? "Adding…" : "Add boss"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editBoss && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm" onClick={() => !editSaving && setEditBoss(null)}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">{initials(editBoss)}</div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Edit boss</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{editBoss.id === currentBoss.id ? "You can change your own password here." : "Update email and name."}</p>
              </div>
            </div>
            <form onSubmit={handleEdit} className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Email</span>
                <input required type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-600" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Full name</span>
                <input type="text" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-600" />
              </label>
              {editBoss.id === currentBoss.id && (
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">New password (optional, min 8)</span>
                  <input type="password" minLength={8} value={editNewPassword} onChange={(e) => setEditNewPassword(e.target.value)} placeholder="Leave blank to keep current" className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600" />
                </label>
              )}
              {editError && <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditBoss(null)} disabled={editSaving} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">Cancel</button>
                <button type="submit" disabled={editSaving} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">{editSaving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteBoss && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm" onClick={() => !deleteSaving && (setDeleteBoss(null), setDeleteError(null))}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-400">{initials(deleteBoss)}</div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Remove boss</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">They won’t be able to sign in again.</p>
              </div>
            </div>
            <p className="mt-4 rounded-lg bg-zinc-100 py-3 px-4 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <strong>{deleteBoss.fullName || deleteBoss.email}</strong>
              <span className="block mt-0.5 text-zinc-500 dark:text-zinc-400">{deleteBoss.email}</span>
            </p>
            {deleteError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => { setDeleteBoss(null); setDeleteError(null); }} disabled={deleteSaving} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleteSaving} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-600">{deleteSaving ? "Removing…" : "Remove"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
