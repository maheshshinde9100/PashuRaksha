import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import DashboardClient from "../ui/dashboard-client";

export const metadata = { title: "Farm dashboard | PashuRaksha" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: farm, error: farmError } = await supabase
    .from("farms")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (farmError) {
    return <SetupMessage title="We couldn’t load your farm yet" detail="Check that the PashuRaksha database setup has been run in Supabase, then refresh this page." />;
  }

  if (!farm) {
    return <SetupMessage title="Your farm is almost ready" detail="Your farm workspace is created when you sign up. If you just confirmed your email, sign out and sign back in to refresh your account." />;
  }

  const { data: animals = [], error: animalsError } = await supabase
    .from("animals")
    .select("id, name, tag, breed, status, created_at")
    .eq("farm_id", farm.id)
    .order("name");

  const animalIds = (animals || []).map((animal) => animal.id);
  const [{ data: readings = [], error: readingsError }, { data: alerts = [], error: alertsError }] = animalIds.length
    ? await Promise.all([
      supabase.from("sensor_readings").select("id, animal_id, temperature_c, heart_rate_bpm, activity_level, recorded_at").in("animal_id", animalIds).order("recorded_at", { ascending: false }).limit(100),
      supabase.from("alerts").select("id, animal_id, severity, title, message, created_at, resolved_at").eq("farm_id", farm.id).order("created_at", { ascending: false }).limit(20),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];

  return <DashboardClient
    farm={farm}
    user={{ email: user.email, name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Farmer" }}
    initialAnimals={animals || []}
    initialReadings={readings || []}
    initialAlerts={alerts || []}
    dataError={animalsError?.message || readingsError?.message || alertsError?.message || null}
  />;
}

function SetupMessage({ title, detail }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8faf6] px-5"><section className="max-w-lg rounded-2xl border border-[#dce6dc] bg-white p-8 shadow-sm"><Link href="/" className="text-sm font-semibold text-[#216644]">PashuRaksha</Link><h1 className="mt-8 text-2xl font-semibold tracking-tight text-[#183d2c]">{title}</h1><p className="mt-3 leading-7 text-[#617166]">{detail}</p><Link href="/login" className="mt-6 inline-flex rounded-lg bg-[#216644] px-4 py-2.5 text-sm font-medium text-white">Return to sign in</Link></section></main>;
}
