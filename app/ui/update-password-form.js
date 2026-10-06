"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword } from "../actions/auth";

const Arrow = () => <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="M3 10h13M11 5l5 5-5 5" /></svg>;
const BrandMark = () => <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#216644] text-white"><svg viewBox="0 0 28 28" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M5 18c1-6 5-9 10-9 4 0 7 3 8 7-3 1-5 1-7 0-1.5 3-5 5-9 4M6 13 3 10M20 10l4-3" /></svg></span>;

export default function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);

  return (
    <main className="min-h-screen bg-[#f8faf6]">
      <div className="mx-auto grid min-h-screen max-w-7xl place-items-center px-5 py-12">
        <section className="w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-[#183d2c]">
            <BrandMark />
            PashuRaksha
          </Link>

          <div className="mt-10 rounded-2xl border border-[#dce6dc] bg-white p-7 shadow-[0_18px_45px_rgba(29,67,43,.08)] sm:p-9">
            <p className="text-[11px] font-semibold tracking-[.16em] text-[#34704c]">ACCOUNT SECURITY</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-[#183d2c]">Choose a new password</h1>
            <p className="mt-3 text-sm leading-6 text-[#617166]">
              Use at least 8 characters to secure your farm workspace.
            </p>

            <form action={action} className="mt-7 space-y-4">
              <label className="block text-sm font-medium text-[#315946]">
                New password
                <input
                  required
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="mt-2 w-full rounded-lg border border-[#d6e1d5] bg-white px-3.5 py-3 text-[15px] font-normal text-[#183d2c] outline-none placeholder:text-[#a0aaa0] focus:border-[#6f9c73] focus:ring-4 focus:ring-[#dcebd7]/70"
                />
              </label>

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
                {pending ? "Saving…" : "Update password"}
                {!pending && <Arrow />}
              </button>
            </form>
          </div>

          <p className="mt-7 text-center text-xs text-[#879387]">
            © 2026 PashuRaksha · Livestock care, made clearer
          </p>
        </section>
      </div>
    </main>
  );
}
