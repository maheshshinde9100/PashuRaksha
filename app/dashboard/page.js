import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, ensureFarmForCurrentUser } from "../../lib/supabase/server";
import DashboardClient from "../ui/dashboard-client";

export const metadata = { title: "Farm dashboard | PashuRaksha" };

const BrandMark = () => (
  <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#216644] text-white">
    <svg viewBox="0 0 28 28" className="h-5 w-5 fill-none stroke-current stroke-2">
      <path d="M5 18c1-6 5-9 10-9 4 0 7 3 8 7-3 1-5 1-7 0-1.5 3-5 5-9 4M6 13 3 10M20 10l4-3" />
    </svg>
  </span>
);

const Arrow = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-2">
    <path d="M3 10h13M11 5l5 5-5 5" />
  </svg>
);

const Reload = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const farmNameFromMetadata =
    (user.user_metadata && user.user_metadata.farm_name) ||
    (user.email ? `${user.email.split("@")[0]} Farm` : "My Farm");

  const provisionResult = await ensureFarmForCurrentUser({
    fallbackName: farmNameFromMetadata,
  });

  let farm;
  let provisionKind;
  let provisionDetail;

  if (provisionResult.ok) {
    farm = provisionResult.farm;
  } else {
    provisionKind =
      provisionResult.reason === "missing_migration" ? "migration" : "farm";
    provisionDetail = provisionResult.detail;

    const fallbackQuery = await supabase
      .from("farms")
      .select("id, name")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (fallbackQuery.data) {
      farm = fallbackQuery.data;
    } else if (fallbackQuery.error) {
      const msg = String(
        fallbackQuery.error.message || fallbackQuery.error.code || ""
      ).toLowerCase();
      if (/relation|does not exist|undefined_table|schema cache|could not find the table|42p01/.test(msg)) {
        provisionKind = "migration";
        if (!provisionDetail) provisionDetail = fallbackQuery.error.message || null;
      }
    }
  }

  if (!farm) {
    const isMigration = provisionKind === "migration";
    return (
      <SetupMessage
        title={
          isMigration
            ? "Database schema is not installed yet"
            : "Your farm workspace is not ready yet"
        }
        detail={
          isMigration
            ? "Paste supabase/migrations/202610070001_pashuraksha_dashboard.sql into the Supabase SQL Editor and run it, then refresh this page. This creates the farms, animals, sensor_readings and alerts tables, secure row-level access rules, and the on-auth-user trigger + self-serve RPC the app uses to create each user's farm."
            : provisionDetail
              ? `The app attempted to create your farm row, but the database returned: ${provisionDetail}. Sign out and sign back in, or refresh this page to try again.`
              : "Sign out and sign back in once so your session is refreshed. The app will attempt to create your farm row automatically on each sign-in and dashboard visit."
        }
        kind={isMigration ? "migration" : "farm"}
      />
    );
  }

  const { data: animals = [], error: animalsError } = await supabase
    .from("animals")
    .select("id, name, tag, breed, status, created_at")
    .eq("farm_id", farm.id)
    .order("name");

  const animalIds = (animals || []).map((animal) => animal.id);
  const readingLimit = Math.max(600, animals.length * 40);
  const [
    { data: readings = [], error: readingsError },
    { data: alerts = [], error: alertsError },
  ] = animalIds.length
    ? await Promise.all([
        supabase
          .from("sensor_readings")
          .select(
            "id, animal_id, temperature_c, humidity_pct, heart_rate_bpm, motion_pct, activity_level, accel_x_g, accel_y_g, accel_z_g, gyro_x_dps, gyro_y_dps, gyro_z_dps, recorded_at"
          )
          .in("animal_id", animalIds)
          .order("recorded_at", { ascending: false })
          .limit(readingLimit),
        supabase
          .from("alerts")
          .select(
            "id, animal_id, severity, title, message, created_at, resolved_at"
          )
          .eq("farm_id", farm.id)
          .order("created_at", { ascending: false })
          .limit(80),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  return (
    <DashboardClient
      farm={farm}
      user={{
        email: user.email,
        name:
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Farmer",
      }}
      initialAnimals={animals || []}
      initialReadings={readings || []}
      initialAlerts={alerts || []}
      dataError={
        animalsError?.message ||
        readingsError?.message ||
        alertsError?.message ||
        null
      }
    />
  );
}

function SetupMessage({ title, detail, kind = "farm" }) {
  return (
    <main className="min-h-screen bg-[#f8faf6]">
      <div className="mx-auto grid min-h-screen max-w-7xl place-items-center px-5">
        <section className="w-full max-w-lg">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-[#183d2c]"
          >
            <BrandMark />
            PashuRaksha
          </Link>
          <div className="mt-10 rounded-2xl border border-[#dce6dc] bg-white p-8 shadow-[0_18px_45px_rgba(29,67,43,.08)]">
            <p className="text-[11px] font-semibold tracking-[.16em] text-[#34704c]">
              {kind === "migration" ? "DATABASE SETUP" : "FARM WORKSPACE"}
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-.04em] text-[#183d2c]">
              {title}
            </h1>
            <p className="mt-3 leading-7 text-[#617166]">{detail}</p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <form method="get" action="">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#216644] px-5 py-3 text-sm font-semibold text-white hover:bg-[#194f34]"
                >
                  <Reload />
                  Refresh page
                </button>
              </form>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#cbdac9] px-5 py-3 text-sm font-medium text-[#315946]"
              >
                Return to sign in
                <Arrow />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
