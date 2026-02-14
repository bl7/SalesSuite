"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

type LoginResponse = { ok: boolean; error?: string };

export default function BossLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/boss/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.boss) router.replace("/boss/dashboard");
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/boss/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = (await res.json()) as LoginResponse;
    setLoading(false);

    if (!res.ok || !data.ok) {
      setError(data.error ?? "Login failed");
      return;
    }

    router.push("/boss/dashboard");
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121316]">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#121316] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image
            src="/icon.svg"
            alt="SalesSuite"
            width={120}
            height={120}
            className="h-12 w-auto dark:hidden"
          />
          <Image
            src="/icon-r.svg"
            alt="SalesSuite"
            width={120}
            height={120}
            className="hidden h-12 w-auto dark:block"
          />
        </div>
        <h1 className="text-center text-2xl font-semibold text-white">
          Boss dashboard
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Sign in to view platform overview
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="sr-only">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-xl border border-zinc-600 bg-zinc-800/80 px-4 py-3 text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="sr-only">Password</span>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-zinc-600 bg-zinc-800/80 px-4 py-3 pr-12 text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error && (
            <p className="text-center text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white py-3 font-medium text-zinc-900 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Separate login for platform bosses. No email verification.
        </p>
      </div>
    </div>
  );
}
