"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Totals = { companies: number; activeSubscription: number; expiredSubscription: number };
type RecentSignup = { name: string; createdAt: string };

export default function BossOverviewPage() {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [recentSignups, setRecentSignups] = useState<RecentSignup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/boss/companies?limit=1&page=1")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.ok) {
          if (data.totals) setTotals(data.totals);
          if (Array.isArray(data.recentSignups)) setRecentSignups(data.recentSignups);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Overview</h1>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Platform summary. Staff counts and contact details are per company on the Companies page.
      </p>

      {loading ? (
        <div className="mt-4 flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 w-28 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
      ) : totals ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/boss/dashboard/companies"
            className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Companies</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{totals.companies}</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">View all →</p>
          </Link>
          <Link
            href="/boss/dashboard/companies"
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/20"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Active subscription</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">{totals.activeSubscription}</p>
            <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-500">Companies with access</p>
          </Link>
          <Link
            href="/boss/dashboard/companies"
            className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Expired / No subscription</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">{totals.expiredSubscription}</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Suspended or past due</p>
          </Link>
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Could not load overview.</p>
      )}

      {!loading && recentSignups.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent signups</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Latest companies by signup date</p>
          <ul className="mt-3 space-y-2">
            {recentSignups.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{s.name}</span>
                <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                  {new Date(s.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/boss/dashboard/companies"
            className="mt-3 inline-block text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:underline"
          >
            View all companies →
          </Link>
        </div>
      )}
    </div>
  );
}
