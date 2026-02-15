"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { MeResponse } from "./types";

type SessionState = {
  user: NonNullable<MeResponse["user"]>;
  company: NonNullable<MeResponse["company"]>;
  refreshSession: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Omit<SessionState, "refreshSession"> | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const data = (await res.json()) as MeResponse;
    if (res.status === 403 && data.subscriptionExpired) {
      router.push(
        `/subscription-expired${data.companyName ? `?company=${encodeURIComponent(data.companyName)}` : ""}`
      );
      return;
    }
    if (!res.ok || !data.ok || !data.user || !data.company) {
      router.push("/auth/login");
      return;
    }
    if (data.user.role === "rep") {
      router.replace("/rep-mobile-required");
      return;
    }
    setSession({ user: data.user, company: data.company });
  }, [router]);

  useEffect(() => {
    void refreshSession().then(() => setLoading(false));
  }, [refreshSession]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-[#0d1117]">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <SessionContext.Provider value={{ ...session, refreshSession }}>
      {children}
    </SessionContext.Provider>
  );
}

