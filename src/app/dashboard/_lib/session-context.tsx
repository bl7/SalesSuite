"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { MeResponse } from "./types";

type SessionState = {
  user: NonNullable<MeResponse["user"]>;
  company: NonNullable<MeResponse["company"]>;
};

const SessionContext = createContext<SessionState | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
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
      setSession({ user: data.user, company: data.company });
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-[#0d1117]">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (!session) return null;

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

