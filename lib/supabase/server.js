import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

function buildCookieAdapter(cookieStore, isSecure) {
  return {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, {
            ...options,
            secure: isSecure,
            sameSite: options?.sameSite || "lax",
          })
        );
      } catch {
        // Server Components cannot write cookies; Server Actions and Proxy refresh sessions.
      }
    },
  };
}

async function getRequestContext() {
  const cookieStore = await cookies();
  const host = (await headers()).get("host");
  const isSecure = !host?.startsWith("localhost:");
  return { cookieStore, isSecure };
}

function requireEnv(key) {
  if (!process.env[key]) {
    throw new Error(
      `Supabase is not configured. Set ${key} in the environment (loaded via .env / .env.local / host platform).`
    );
  }
  return process.env[key];
}

export async function createClient({ admin = false } = {}) {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const { cookieStore, isSecure } = await getRequestContext();

  if (admin) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new Error(
        "Admin Supabase client requested but SUPABASE_SERVICE_ROLE_KEY is not set. Add it to your server environment (never a NEXT_PUBLIC_ variable)."
      );
    }

    return createServerClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      cookies: buildCookieAdapter(cookieStore, isSecure),
    });
  }

  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createServerClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    cookies: buildCookieAdapter(cookieStore, isSecure),
  });
}

/**
 * Result shape for ensureFarmForCurrentUser. Never throws — returns a structured
 * result so callers can surface actionable UI instead of showing a generic
 * "farm not ready" message.
 *
 *   { ok: true,  farm: {id, name, owner_id} }
 *   { ok: false, reason: 'not_authed' | 'missing_migration' | 'insert_failed' | 'unknown', detail: string | null }
 */
export async function ensureFarmForCurrentUser({ fallbackName = "My Farm" } = {}) {
  const nameCandidate = String(fallbackName || "").trim() || "My Farm";

  // First: resolve the current user from the session-bearing anon client.
  // Must use the anon (session) client, not the admin client — admin has no
  // access to the request's cookie session.
  let sessionClient;
  let uid;
  try {
    sessionClient = await createClient();
    const { data, error } = await sessionClient.auth.getUser();
    if (error || !data?.user?.id) {
      return { ok: false, reason: "not_authed", detail: error?.message || null };
    }
    uid = data.user.id;
  } catch (err) {
    return {
      ok: false,
      reason: "not_authed",
      detail: err instanceof Error ? err.message : null,
    };
  }

  //
  // PATH 1 — direct admin-service-role SQL upsert bypassing all policies / RLS / triggers.
  // This is the most reliable path. It runs ONLY if SUPABASE_SERVICE_ROLE_KEY env is set.
  //
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = await createClient({ admin: true });

      const { data: existing, error: findErr } = await admin
        .from("farms")
        .select("id, name, owner_id")
        .eq("owner_id", uid)
        .limit(1)
        .maybeSingle();

      if (existing && !findErr) {
        return { ok: true, farm: existing };
      }

      // If findErr is "relation does not exist" / permission errors the tables
      // simply aren't installed yet — we can't insert.
      if (findErr && schemaRelationError(findErr)) {
        return {
          ok: false,
          reason: "missing_migration",
          detail: findErr.message || null,
        };
      }

      const { data: inserted, error: insertErr } = await admin
        .from("farms")
        .insert({ owner_id: uid, name: nameCandidate })
        .select("id, name, owner_id")
        .maybeSingle();

      if (inserted && !insertErr) {
        return { ok: true, farm: inserted };
      }

      // Insert failed with a schema error — probably migration not applied.
      if (insertErr && schemaRelationError(insertErr)) {
        return {
          ok: false,
          reason: "missing_migration",
          detail: insertErr.message || null,
        };
      }

      // Non-fatal insert error (e.g. unique race) — re-query to confirm row exists.
      const { data: finalExisting } = await admin
        .from("farms")
        .select("id, name, owner_id")
        .eq("owner_id", uid)
        .limit(1)
        .maybeSingle();
      if (finalExisting) return { ok: true, farm: finalExisting };

      return {
        ok: false,
        reason: "insert_failed",
        detail: insertErr?.message || "Admin INSERT returned no row.",
      };
    } catch (err) {
      // Admin path threw — fall through to self-serve RPC path below so we
      // still attempt a best-effort provisioning before returning an error.
    }
  }

  //
  // PATH 2 — security-definer self-serve RPC `ensure_own_farm(p_farm_name)`.
  // Works with only the anon key provided the PashuRaksha migration SQL ran.
  //
  try {
    const { data, error } = await sessionClient.rpc("ensure_own_farm", {
      p_farm_name: nameCandidate,
    });
    if (!error && data) return { ok: true, farm: data };
  } catch {
    // RPC may not exist yet if migration hasn't been applied.
  }

  //
  // PATH 3 — best-effort SELECT via RLS SELECT policy (no write attempt).
  //
  try {
    const { data, error } = await sessionClient
      .from("farms")
      .select("id, name, owner_id")
      .eq("owner_id", uid)
      .limit(1)
      .maybeSingle();

    if (!error && data) return { ok: true, farm: data };
    if (error && schemaRelationError(error)) {
      return { ok: false, reason: "missing_migration", detail: error.message || null };
    }
  } catch {
    // Fall through to generic failure below.
  }

  return {
    ok: false,
    reason: "unknown",
    detail: null,
  };
}

function schemaRelationError(err) {
  const msg = String(
    (err && (err.message || err.hint || err.code)) ?? ""
  ).toLowerCase();
  return /relation|does not exist|undefined_table|permission denied|policy|row level security|rls|42p01|42501|schema cache|could not find the table|schema cache not found|function .* does not exist/.test(
    msg
  );
}
