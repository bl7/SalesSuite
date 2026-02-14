"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BossSessionProvider, useBossSession } from "./_lib/boss-session-context";

const navItems = [
  { label: "Overview", href: "/boss/dashboard", icon: GridIcon },
  { label: "Companies", href: "/boss/dashboard/companies", icon: BuildingIcon },
  { label: "Bosses", href: "/boss/dashboard/bosses", icon: UsersIcon },
];

export default function BossDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BossSessionProvider>
      <BossDashboardShell>{children}</BossDashboardShell>
    </BossSessionProvider>
  );
}

const SIDEBAR_COLLAPSED_KEY = "boss-sidebar-collapsed";

function BossDashboardShell({ children }: { children: React.ReactNode }) {
  const boss = useBossSession();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  });

  useEffect(() => setSidebarOpen(false), [pathname]);
  useEffect(() => {
    if (!sidebarOpen) return;
    const onEscape = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebarOpen(false); };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [sidebarOpen]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0"); } catch (_) {}
      return next;
    });
  }

  async function onLogout() {
    await fetch("/api/boss/auth/logout", { method: "POST" });
    router.push("/boss/login");
  }

  return (
    <div className="flex h-screen bg-zinc-100 dark:bg-[#0d1117]">
      <div
        aria-hidden
        className={`fixed inset-0 z-40 bg-zinc-900/50 transition-opacity lg:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-zinc-200 bg-white shadow-xl transition-[width] duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-900 lg:static lg:shrink-0 lg:shadow-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "w-[72px] max-w-[72px]" : "w-[220px] max-w-[85vw] lg:max-w-none"}`}
      >
        <div className={`relative flex items-center justify-center border-b border-zinc-200 px-2 dark:border-zinc-800 ${collapsed ? "min-h-[72px]" : "min-h-[140px]"}`}>
          <Link href="/boss/dashboard" className="flex shrink-0 items-center justify-center focus:outline-none" aria-label="SalesSuite home">
            {collapsed ? (
              <>
                <Image src="/icon.svg" alt="" width={48} height={48} className="h-10 w-10 object-contain dark:hidden" />
                <Image src="/icon-r.svg" alt="" width={48} height={48} className="hidden h-10 w-10 object-contain dark:block" />
              </>
            ) : (
              <>
                <Image src="/logo.svg" alt="" width={120} height={120} className="max-w-[120px] max-h-[120px] object-contain dark:hidden" />
                <Image src="/logo-dark.svg" alt="" width={120} height={120} className="hidden max-w-[120px] max-h-[120px] object-contain dark:block" />
              </>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-500 hover:bg-zinc-100 lg:hidden dark:hover:bg-zinc-800"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {navItems.map((item) => {
            const active = item.href === "/boss/dashboard" ? pathname === "/boss/dashboard" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  collapsed ? "justify-center" : "gap-2.5"
                } ${
                  active ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
                }`}
              >
                <item.icon active={active} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-200 px-2 py-3 dark:border-zinc-800">
          <div className={`flex items-center gap-2 ${collapsed ? "flex-col justify-center gap-1" : ""}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-white dark:bg-zinc-200 dark:text-zinc-900">
              {(boss.fullName || boss.email).charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-zinc-900 dark:text-zinc-100">{boss.fullName || "Boss"}</p>
                  <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{boss.email}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  title="Log out"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                </button>
              </>
            )}
            {collapsed && (
              <button
                onClick={onLogout}
                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                title="Log out"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white shadow hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          )}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-3 lg:hidden dark:border-zinc-800 dark:bg-zinc-900">
          <button type="button" onClick={() => setSidebarOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400" aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
          <Link href="/boss/dashboard" className="flex shrink-0">
            <Image src="/logo.svg" alt="SalesSuite" width={32} height={32} className="dark:hidden" />
            <Image src="/logo-dark.svg" alt="SalesSuite" width={32} height={32} className="hidden dark:block" />
          </Link>
          <div className="h-8 w-8" />
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-5">{children}</div>
        </main>
      </div>
    </div>
  );
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className={active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function BuildingIcon({ active }: { active: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className={active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className={active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
