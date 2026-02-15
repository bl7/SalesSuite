"use client";

import Image from "next/image";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type LoginResponse = {
  ok: boolean;
  error?: string;
  session?: { role: string };
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      setSuccess("Email verified successfully! You can now log in.");
    }
  }, [searchParams]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = (await response.json()) as LoginResponse;
    setLoading(false);

    if (!response.ok || !data.ok) {
      setError(data.error ?? "Login failed");
      return;
    }

    if (data.session?.role === "rep") {
      router.push("/rep-mobile-required");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f3f2f6] px-6 py-6 dark:bg-[#0d1117]">
      <div className="mx-auto flex h-full max-w-2xl items-center">
        <div className="w-full text-center">
          <div className="mb-6 flex justify-center">
            <Image
              src="/logo.svg"
              alt="SalesSuite"
              width={90}
              height={90}
              className="dark:hidden"
            />
            <Image
              src="/logo-dark.svg"
              alt="SalesSuite"
              width={90}
              height={90}
              className="hidden dark:block"
            />
          </div>
          <h1 className="text-[64px] leading-none font-serif text-zinc-900 md:text-[56px] dark:text-zinc-100">
            Welcome back
          </h1>
          <p className="mt-4 text-[30px] text-zinc-500 md:text-[18px] dark:text-zinc-400">
            Sign in to manage staff, shops, and field operations
          </p>

          <form onSubmit={onSubmit} className="mx-auto mt-8 max-w-xl space-y-4">
            <Field>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="h-14 w-full rounded-2xl border border-zinc-200 bg-[#f7f7f8] px-5 text-[24px] text-zinc-800 placeholder:text-zinc-400 md:text-[18px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </Field>

            <Field>
              <div className="relative">
                <input
                  required
                  minLength={8}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  className="h-14 w-full rounded-2xl border border-zinc-200 bg-[#f7f7f8] px-5 pr-16 text-[24px] text-zinc-800 placeholder:text-zinc-400 md:text-[18px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </Field>

            {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
            {success ? <p className="text-center text-sm text-emerald-600">{success}</p> : null}

            <div className="text-right">
              <button
                type="button"
                onClick={() => router.push("/auth/forgot-password")}
                className="text-[13px] font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Forgot password?
              </button>
            </div>

            <div className="pt-2 text-center">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-14 min-w-64 items-center justify-center rounded-full bg-zinc-800 px-10 text-[20px] font-medium text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)] disabled:opacity-60 md:text-[18px] dark:bg-zinc-100 dark:text-zinc-900"
              >
                {loading ? "Signing in..." : "Continue"}
              </button>
              <p className="mt-5 text-[24px] text-zinc-500 md:text-[16px] dark:text-zinc-400">
                Need an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/auth/signup")}
                  className="font-medium text-zinc-700 underline underline-offset-2 dark:text-zinc-200"
                >
                  Sign up
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field(props: { children: React.ReactNode }) {
  return <label className="block">{props.children}</label>;
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3 4.1" />
      <path d="M6.7 6.7C4 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.3-1.6" />
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M14.1 14.1a3 3 0 0 1-4.2-4.2" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="h-screen overflow-hidden bg-[#f3f2f6] px-6 py-6 dark:bg-[#0d1117]">
        <div className="mx-auto flex h-full max-w-2xl items-center">
          <div className="w-full text-center">
            <h1 className="text-[64px] leading-none font-serif text-zinc-900 md:text-[56px] dark:text-zinc-100">
              Welcome back
            </h1>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

