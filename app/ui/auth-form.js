"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { requestPasswordReset, signIn, signUp } from "../actions/auth";

const Arrow = () => <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="M3 10h13M11 5l5 5-5 5" /></svg>;

function BrandMark() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#216644] text-white">
      <svg viewBox="0 0 28 28" className="h-5 w-5 fill-none stroke-current stroke-2">
        <path d="M5 18c1-6 5-9 10-9 4 0 7 3 8 7-3 1-5 1-7 0-1.5 3-5 5-9 4M6 13 3 10M20 10l4-3" />
      </svg>
    </span>
  );
}

export default function AuthForm({ mode }) {
  const [showReset, setShowReset] = useState(false);
  const action = showReset ? requestPasswordReset : mode === "signup" ? signUp : signIn;
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f8faf6] px-5 py-12">
      <section className="w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <Link href="/" className="inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-[#183d2c]">
            <BrandMark />
            PashuRaksha
          </Link>
        </div>

        <div className="rounded-2xl border border-[#dce6dc] bg-white p-7 shadow-[0_18px_45px_rgba(29,67,43,.08)] sm:p-9">
          <h1 className="text-2xl font-semibold tracking-[-.04em] text-[#183d2c]">
            {showReset ? "Reset your password" : mode === "signup" ? "Create your farm account" : "Sign in to your farm"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#617166]">
            {showReset
              ? "We’ll send a secure reset link to your email."
              : mode === "signup"
              ? "Set up your farm workspace to track animal health."
              : "Access your herd overview and health alerts."}
          </p>

          {!showReset && (
            <div className="mt-6 flex gap-2 border-b border-[#dce6dc]">
              <Link
                href="/login"
                className={`-mb-px border-b-2 px-1 pb-3 text-sm ${
                  mode === "login"
                    ? "border-[#216644] font-medium text-[#216644]"
                    : "border-transparent text-[#66766a] hover:text-[#315946]"
                }`}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className={`-mb-px border-b-2 px-1 pb-3 text-sm ${
                  mode === "signup"
                    ? "border-[#216644] font-medium text-[#216644]"
                    : "border-transparent text-[#66766a] hover:text-[#315946]"
                }`}
              >
                Create account
              </Link>
            </div>
          )}

          <form action={formAction} className="mt-7 space-y-4">
            {mode === "signup" && !showReset && (
              <>
                <Field label="Your name" name="fullName" placeholder="e.g. Ramesh Patel" autoComplete="name" />
                <Field label="Farm name" name="farmName" placeholder="e.g. Green Valley Dairy" autoComplete="organization" />
              </>
            )}
            <Field label="Email address" name="email" type="email" placeholder="you@example.com" autoComplete="email" />
            {!showReset && (
              <Field
                label="Password"
                name="password"
                type="password"
                placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={mode === "signup" ? 8 : undefined}
              />
            )}
            {mode === "login" && !showReset && (
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="-mt-1 text-sm font-medium text-[#34704c] hover:text-[#183d2c]"
              >
                Forgot password?
              </button>
            )}
            {state?.error && (
              <p role="alert" className="rounded-lg border border-[#efd2c9] bg-[#fff4ef] px-3.5 py-3 text-sm text-[#8e3c2c]">
                {state.error}
              </p>
            )}
            {state?.success && (
              <p role="status" className="rounded-lg border border-[#c9dfc8] bg-[#eff7ed] px-3.5 py-3 text-sm text-[#315946]">
                {state.success}
              </p>
            )}
            <button
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#216644] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#194f34] disabled:cursor-wait disabled:opacity-70"
            >
              {pending
                ? "Please wait…"
                : showReset
                ? "Send reset link"
                : mode === "signup"
                ? "Create farm account"
                : "Sign in"}
              {!pending && <Arrow />}
            </button>
            {showReset && (
              <button
                type="button"
                onClick={() => setShowReset(false)}
                className="w-full py-2 text-sm font-medium text-[#526b57] hover:text-[#183d2c]"
              >
                Back to sign in
              </button>
            )}
          </form>
        </div>

        <p className="mt-7 text-center text-xs text-[#879387]">
          © 2026 PashuRaksha · Livestock care, made clearer
        </p>
      </section>
    </main>
  );
}

function Field({ label, name, type = "text", ...props }) {
  return (
    <label className="block text-sm font-medium text-[#315946]">
      {label}
      <input
        required
        name={name}
        type={type}
        {...props}
        className="mt-2 w-full rounded-lg border border-[#d6e1d5] bg-white px-3.5 py-3 text-[15px] font-normal text-[#183d2c] outline-none placeholder:text-[#a0aaa0] focus:border-[#6f9c73] focus:ring-4 focus:ring-[#dcebd7]/70"
      />
    </label>
  );
}
