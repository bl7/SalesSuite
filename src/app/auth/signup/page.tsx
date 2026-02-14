"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

type SignupResponse = {
  ok: boolean;
  error?: string;
};

const NEPAL_MOBILE_DIGITS = /^\d{10}$/;

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

    if (!NEPAL_MOBILE_DIGITS.test(phoneDigits)) {
      setLoading(false);
      setError("Phone number must be 10 digits");
      return;
    }

    const response = await fetch("/api/auth/signup-company", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyName,
        address: companyAddress.trim(),
        fullName,
        email,
        phone: `+977${phoneDigits}`,
        password,
        role: "manager",
      }),
    });

    const data = (await response.json()) as SignupResponse;
    setLoading(false);

    if (!response.ok || !data.ok) {
      setError(data.error ?? "Signup failed");
      return;
    }

    setSignupEmail(email);
    setSuccess(true);
  }

  if (success) {
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
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-emerald-600 dark:text-emerald-400"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h1 className="text-[64px] leading-none font-serif text-zinc-900 md:text-[56px] dark:text-zinc-100">
              Sign up successful!
            </h1>
            <p className="mt-4 text-[30px] text-zinc-500 md:text-[18px] dark:text-zinc-400">
              We&apos;ve sent a verification email to <strong className="text-zinc-700 dark:text-zinc-200">{signupEmail}</strong>
            </p>
            <p className="mt-3 text-[24px] text-zinc-600 md:text-[16px] dark:text-zinc-400">
              Please check your inbox and click the verification link to activate your account.
            </p>
            <div className="mt-8 space-y-3">
              <button
                onClick={() => router.push("/auth/login")}
                className="inline-flex h-14 min-w-64 items-center justify-center rounded-full bg-zinc-800 px-10 text-[20px] font-medium text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)] md:text-[18px] dark:bg-zinc-100 dark:text-zinc-900"
              >
                Go to login
              </button>
              <p className="text-[20px] text-zinc-500 md:text-[14px] dark:text-zinc-400">
                Didn&apos;t receive the email? Check your spam folder or{" "}
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(false);
                    setError(null);
                  }}
                  className="font-medium text-zinc-700 underline underline-offset-2 dark:text-zinc-200"
                >
                  try again
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
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
            Get started
          </h1>
          <p className="mt-4 text-[30px] text-zinc-500 md:text-[18px] dark:text-zinc-400">
            Set up your company and manager account in under 5 minutes
          </p>

          <form onSubmit={onSubmit} className="mx-auto mt-8 max-w-xl space-y-4">
          <Field>
            <input
              required
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Company name"
              className="h-14 w-full rounded-2xl border border-zinc-200 bg-[#f7f7f8] px-5 text-[24px] text-zinc-800 placeholder:text-zinc-400 md:text-[18px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </Field>

          <Field>
            <input
              required
              value={companyAddress}
              onChange={(event) => setCompanyAddress(event.target.value)}
              placeholder="Company address"
              className="h-14 w-full rounded-2xl border border-zinc-200 bg-[#f7f7f8] px-5 text-[24px] text-zinc-800 placeholder:text-zinc-400 md:text-[18px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <input
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
                className="h-14 w-full rounded-2xl border border-zinc-200 bg-[#f7f7f8] px-5 text-[24px] text-zinc-800 placeholder:text-zinc-400 md:text-[18px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </Field>
            <Field>
              <input
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last name"
                className="h-14 w-full rounded-2xl border border-zinc-200 bg-[#f7f7f8] px-5 text-[24px] text-zinc-800 placeholder:text-zinc-400 md:text-[18px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </Field>
          </div>

          <Field>
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <div className="flex h-14 items-center justify-center rounded-2xl border border-zinc-200 bg-[#f7f7f8] text-[24px] text-zinc-700 md:text-[18px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                +977
              </div>
              <input
                required
                type="tel"
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                value={phoneDigits}
                onChange={(event) =>
                  setPhoneDigits(event.target.value.replace(/[^0-9]/g, "").slice(0, 10))
                }
                placeholder="98XXXXXXXX"
                className="h-14 w-full rounded-2xl border border-zinc-200 bg-[#f7f7f8] px-5 text-[24px] text-zinc-800 placeholder:text-zinc-400 md:text-[18px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </div>
          </Field>

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

            <div className="pt-2 text-center">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-14 min-w-64 items-center justify-center rounded-full bg-zinc-800 px-10 text-[20px] font-medium text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)] disabled:opacity-60 md:text-[18px] dark:bg-zinc-100 dark:text-zinc-900"
              >
                {loading ? "Creating..." : "Continue"}
              </button>
              <p className="mt-5 text-[24px] text-zinc-500 md:text-[16px] dark:text-zinc-400">
                Already started?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/auth/login")}
                  className="font-medium text-zinc-700 underline underline-offset-2 dark:text-zinc-200"
                >
                  Log in
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

