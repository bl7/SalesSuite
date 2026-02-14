"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SubscriptionExpiredContent() {
  const searchParams = useSearchParams();
  const companyName = searchParams.get("company");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f3f2f6] px-4 py-12 dark:bg-[#0d1117]">
      <div className="w-full max-w-md text-center">
        <Image
          src="/logo.svg"
          alt="SalesSuite"
          width={80}
          height={80}
          className="mx-auto dark:hidden"
        />
        <Image
          src="/logo-dark.svg"
          alt="SalesSuite"
          width={80}
          height={80}
          className="mx-auto hidden dark:block"
        />
        <h1 className="mt-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Subscription expired
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {companyName ? (
            <>Access for <strong>{companyName}</strong> has expired or been suspended.</>
          ) : (
            <>Your subscription has expired or been suspended.</>
          )}{" "}
          To continue using SalesSuite, please contact us to renew or update your plan.
        </p>
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Pricing depends on team size. Get in touch and we&apos;ll tailor a plan for you.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href="mailto:support@salessuite.com"
            className="rounded-full bg-zinc-800 px-6 py-3 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Contact support
          </a>
          <Link
            href="/#contact"
            className="rounded-full border border-zinc-300 px-6 py-3 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Request demo
          </Link>
        </div>
        <p className="mt-8 text-xs text-zinc-400 dark:text-zinc-500">
          <Link href="/auth/login" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SubscriptionExpiredPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f3f2f6] dark:bg-[#0d1117]">
          <p className="text-sm text-zinc-500">Loading…</p>
        </div>
      }
    >
      <SubscriptionExpiredContent />
    </Suspense>
  );
}
