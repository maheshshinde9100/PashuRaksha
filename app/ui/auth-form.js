"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { requestPasswordReset, signIn, signUp } from "../actions/auth";

function Mark() {
  return <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#216644] text-white"><svg viewBox="0 0 28 28" className="h-6 w-6 fill-none stroke-current stroke-2"><path d="M5 18c1-6 5-9 10-9 4 0 7 3 8 7-3 1-5 1-7 0-1.5 3-5 5-9 4M6 13 3 10M20 10l4-3" /></svg></span>;
}

export default function AuthForm({ mode }) {
  const [showReset, setShowReset] = useState(false);
  const action = showReset ? requestPasswordReset : mode === "signup" ? signUp : signIn;
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <main className="min-h-screen bg-[#f8faf6]">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[1fr_.9fr]">
        <section className="flex flex-col px-6 py-7 sm:px-10 lg:px-14">
          <Link href="/" className="inline-flex w-fit items-center gap-3 text-[15px] font-semibold tracking-tight text-[#183d2c]"><Mark />PashuRaksha</Link>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-14">
            <p className="text-[11px] font-semibold tracking-[.16em] text-[#34704c]">YOUR FARM, IN GOOD HANDS</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-[#183d2c] sm:text-[2.55rem]">{showReset ? "Reset your password" : mode === "signup" ? "A clearer view of your herd." : "Welcome back."}</h1>
            <p className="mt-3 leading-7 text-[#617166]">{showReset ? "We’ll send a secure reset link to your email." : mode === "signup" ? "Create your farm workspace to keep animal health, alerts and history together." : "Sign in to see today’s herd health and anything that needs your attention."}</p>

            {!showReset && <div className="mt-8 grid grid-cols-2 rounded-lg border border-[#dce6dc] bg-white p-1 text-sm"><Link href="/login" className={`rounded-md px-4 py-2.5 text-center ${mode === "login" ? "bg-[#e9f2e7] font-medium text-[#216644]" : "text-[#66766a]"}`}>Sign in</Link><Link href="/signup" className={`rounded-md px-4 py-2.5 text-center ${mode === "signup" ? "bg-[#e9f2e7] font-medium text-[#216644]" : "text-[#66766a]"}`}>Create account</Link></div>}

            <form action={formAction} className="mt-7 space-y-4">
              {mode === "signup" && !showReset && <>
                <Field label="Your name" name="fullName" placeholder="e.g. Ramesh Patel" autoComplete="name" />
                <Field label="Farm name" name="farmName" placeholder="e.g. Green Valley Dairy" autoComplete="organization" />
              </>}
              <Field label="Email address" name="email" type="email" placeholder="you@example.com" autoComplete="email" />
              {!showReset && <Field label="Password" name="password" type="password" placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} />}
              {mode === "login" && !showReset && <button type="button" onClick={() => setShowReset(true)} className="-mt-1 text-sm font-medium text-[#34704c] hover:text-[#183d2c]">Forgot password?</button>}
              {state?.error && <p role="alert" className="rounded-lg border border-[#efd2c9] bg-[#fff4ef] px-3.5 py-3 text-sm text-[#8e3c2c]">{state.error}</p>}
              {state?.success && <p role="status" className="rounded-lg border border-[#c9dfc8] bg-[#eff7ed] px-3.5 py-3 text-sm text-[#315946]">{state.success}</p>}
              <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#216644] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#194f34] disabled:cursor-wait disabled:opacity-70">
                {pending ? "Please wait…" : showReset ? "Send reset link" : mode === "signup" ? "Create farm account" : "Sign in to your farm"}
                {!pending && <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="M3 10h13M11 5l5 5-5 5" /></svg>}
              </button>
              {showReset && <button type="button" onClick={() => setShowReset(false)} className="w-full py-2 text-sm font-medium text-[#526b57]">Back to sign in</button>}
            </form>
            <p className="mt-7 text-xs leading-5 text-[#7b887d]">By continuing, you agree to use PashuRaksha for responsible animal care. Your farm records are private to your account.</p>
          </div>
          <p className="text-xs text-[#879387]">© 2026 PashuRaksha · Livestock care, made clearer</p>
        </section>

        <aside className="relative hidden overflow-hidden bg-[#203e2e] px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border border-white/10" />
          <div className="absolute -right-6 -top-6 h-60 w-60 rounded-full border border-white/10" />
          <div className="relative z-10 max-w-lg"><p className="text-xs font-semibold tracking-[.18em] text-[#b5d6a7]">CARE THAT KEEPS YOU CONNECTED</p><h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-.04em]">Know your herd. Notice what matters.</h2><p className="mt-5 max-w-md leading-7 text-[#d0dfd0]">A calm, practical workspace for daily animal status, health readings and the history behind every change.</p></div>
          <div className="relative z-10 rounded-2xl border border-white/10 bg-white/[.07] p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between"><div><p className="text-xs text-[#c2d3c2]">TODAY’S HERD SNAPSHOT</p><p className="mt-1 text-lg font-semibold">A little more peace of mind</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#315b43] text-[#c1e1ad]"><svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></span></div>
            <div className="mt-5 grid grid-cols-3 gap-3"><MiniStat label="Health" value="At a glance" /><MiniStat label="Alerts" value="When needed" /><MiniStat label="History" value="Always there" /></div>
            <p className="mt-5 border-t border-white/10 pt-4 text-xs text-[#c2d3c2]">Your actual readings appear once your farm devices are connected.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Field({ label, name, type = "text", ...props }) {
  return <label className="block text-sm font-medium text-[#315946]">{label}<input required name={name} type={type} {...props} className="mt-2 w-full rounded-lg border border-[#d6e1d5] bg-white px-3.5 py-3 text-[15px] font-normal text-[#183d2c] outline-none placeholder:text-[#a0aaa0] focus:border-[#6f9c73] focus:ring-4 focus:ring-[#dcebd7]/70" /></label>;
}

function MiniStat({ label, value }) {
  return <div className="rounded-lg bg-white/[.08] p-3"><p className="text-[10px] uppercase tracking-wider text-[#b5d6a7]">{label}</p><p className="mt-2 text-sm font-medium text-white">{value}</p></div>;
}
