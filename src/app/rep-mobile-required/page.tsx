"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Android app download URL – update when Play Store link is available */
const ANDROID_APP_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL || "https://play.google.com/store/apps";

type MeResponse = {
  ok: boolean;
  error?: string;
  subscriptionExpired?: boolean;
  user?: { id: string; fullName: string; role: string };
  company?: { name: string };
};

export default function RepMobileRequiredPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me");
      const data = (await res.json()) as MeResponse;
      if (cancelled) return;
      if (!res.ok || !data.ok || !data.user) {
        router.replace("/auth/login");
        return;
      }
      if (data.subscriptionExpired) {
        router.replace(`/subscription-expired${data.company?.name ? `?company=${encodeURIComponent(data.company.name)}` : ""}`);
        return;
      }
      if (data.user.role !== "rep") {
        router.replace("/dashboard");
        return;
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/auth/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-[#0d1117]">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-[#0d1117]">
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        <Image
          src="/logo.svg"
          alt="SalesSuite"
          width={72}
          height={72}
          className="mb-6 dark:hidden"
        />
        <Image
          src="/logo-dark.svg"
          alt="SalesSuite"
          width={72}
          height={72}
          className="mb-6 hidden dark:block"
        />
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          SalesSuite for reps is mobile-first
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Your account is a rep account. Please use the SalesSuite mobile app to log
          visits, capture orders, and manage your day.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <a
            href={ANDROID_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Download Android app
          </a>
          <Link
            href="/#contact"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-6 py-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Open help
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-6 py-3.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
