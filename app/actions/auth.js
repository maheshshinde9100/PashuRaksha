"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

const safeEmail = (value) => String(value || "").trim().toLowerCase();

export async function signIn(_previousState, formData) {
  const email = safeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");

  if (!email || !email.includes("@") || !password) {
    return { error: "Enter a valid email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function signUp(_previousState, formData) {
  const fullName = String(formData.get("fullName") || "").trim();
  const farmName = String(formData.get("farmName") || "").trim();
  const email = safeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");

  if (fullName.length < 2 || farmName.length < 2 || !email.includes("@") || password.length < 8) {
    return { error: "Enter your name and farm, a valid email, and a password of at least 8 characters." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, farm_name: farmName },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
    },
  });

  if (error) return { error: error.message };
  if (data.session) redirect("/dashboard");
  return { success: "Check your inbox to confirm your email. Your farm workspace will be ready after confirmation." };
}

export async function requestPasswordReset(_previousState, formData) {
  const email = safeEmail(formData.get("email"));
  if (!email.includes("@")) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/account/update-password`,
  });

  if (error) return { error: error.message };
  return { success: "If an account exists for that email, a password reset link is on its way." };
}

export async function updatePassword(_previousState, formData) {
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "Choose a password with at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
