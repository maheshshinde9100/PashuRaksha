"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword } from "../actions/auth";

export default function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);

  return <main className="grid min-h-screen place-items-center bg-[#f8faf6] px-5 py-12"><section className="w-full max-w-md rounded-2xl border border-[#dce6dc] bg-white p-7 shadow-[0_18px_45px_rgba(29,67,43,.08)] sm:p-9"><Link href="/" className="text-sm font-semibold text-[#216644]">← PashuRaksha</Link><p className="mt-10 text-[11px] font-semibold tracking-[.16em] text-[#34704c]">ACCOUNT SECURITY</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-[#183d2c]">Choose a new password</h1><p className="mt-3 text-sm leading-6 text-[#617166]">Use at least 8 characters to secure your account.</p><form action={action} className="mt-7 space-y-4"><label className="block text-sm font-medium text-[#315946]">New password<input required name="password" type="password" minLength={8} autoComplete="new-password" className="mt-2 w-full rounded-lg border border-[#d6e1d5] px-3.5 py-3 outline-none focus:border-[#6f9c73] focus:ring-4 focus:ring-[#dcebd7]/70" /></label>{state?.error && <p role="alert" className="text-sm text-[#8e3c2c]">{state.error}</p>}<button disabled={pending} className="w-full rounded-lg bg-[#216644] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-70">{pending ? "Saving…" : "Update password"}</button></form></section></main>;
}
