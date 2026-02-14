"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type BossInfo = {
  id: string;
  email: string;
  fullName: string;
};

const BossSessionContext = createContext<BossInfo | null>(null);

export function useBossSession() {
  const ctx = useContext(BossSessionContext);
  if (!ctx) throw new Error("useBossSession must be used inside BossSessionProvider");
  return ctx;
}

export function BossSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [boss, setBoss] = useState<BossInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/boss/auth/me");
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok || !data.ok || !data.boss) {
        router.replace("/boss/login");
        return;
      }
      setBoss(data.boss);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-900">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (!boss) return null;

  return (
    <BossSessionContext.Provider value={boss}>
      {children}
    </BossSessionContext.Provider>
  );
}
