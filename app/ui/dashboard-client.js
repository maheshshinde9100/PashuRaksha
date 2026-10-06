"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "../actions/auth";
import { addAnimal } from "../actions/animals";
import { createClient } from "../../lib/supabase/browser";
import { useActionState } from "react";

const Icon = ({ type = "pulse" }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
    {type === "pulse"
      ? <path d="M3 12h4l2-5 4 10 2-5h6" />
      : type === "bell"
      ? <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>
      : type === "device"
      ? <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M10 17h4M9 7h6" /></>
      : type === "profile"
      ? <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 3.5-6 8-6s7.2 2 8 6" /></>
      : type === "overview"
      ? <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>
      : type === "herd"
      ? <><path d="M5 18c1-6 5-9 10-9 4 0 7 3 8 7-3 1-5 1-7 0-1.5 3-5 5-9 4M6 13 3 10M20 10l4-3" /></>
      : type === "history"
      ? <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>
      : type === "alert"
      ? <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /></>
      : type === "check"
      ? <path d="M20 6 9 17l-5-5" />
      : type === "menu"
      ? <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>
      : type === "logout"
      ? <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>
      : type === "close"
      ? <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>
      : type === "plus"
      ? <><path d="M12 5v14" /><path d="M5 12h14" /></>
      : null}
  </svg>
);

const BrandMark = () => (
  <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#216644] text-white">
    <svg viewBox="0 0 28 28" className="h-5 w-5 fill-none stroke-current stroke-2">
      <path d="M5 18c1-6 5-9 10-9 4 0 7 3 8 7-3 1-5 1-7 0-1.5 3-5 5-9 4M6 13 3 10M20 10l4-3" />
    </svg>
  </span>
);

const navItems = [
  ["Overview", "overview", "overview"],
  ["My herd", "herd", "herd"],
  ["Health history", "history", "history"],
  ["Alerts", "alerts", "alert"],
];

export default function DashboardClient({ farm, user, initialAnimals, initialReadings, initialAlerts, dataError }) {
  const [animals, setAnimals] = useState(initialAnimals);
  const [readings, setReadings] = useState(initialReadings);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [live, setLive] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [addState, addAction, adding] = useActionState(addAnimal, undefined);

  const latestByAnimal = useMemo(() => {
    const byAnimal = new Map();
    [...readings]
      .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
      .forEach((reading) => {
        if (!byAnimal.has(reading.animal_id)) byAnimal.set(reading.animal_id, reading);
      });
    return byAnimal;
  }, [readings]);

  const activeAlerts = alerts.filter((alert) => !alert.resolved_at);
  const needsAttention = animals.filter((animal) => {
    const reading = latestByAnimal.get(animal.id);
    return animal.status === "needs_attention" || (reading?.temperature_c != null && reading.temperature_c >= 39.5);
  }).length;

  useEffect(() => {
    if (!initialAnimals.length) return undefined;
    let channel;
    try {
      const supabase = createClient();
      const animalIds = new Set(initialAnimals.map((animal) => animal.id));
      channel = supabase
        .channel(`farm-live-${farm.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "sensor_readings" }, ({ new: row }) => {
          if (!animalIds.has(row.animal_id)) return;
          setReadings((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 100));
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, ({ new: row }) => {
          if (row.farm_id !== farm.id) return;
          setAlerts((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 20));
        })
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    } catch {
      channel = null;
    }
    return () => {
      if (channel) createClient().removeChannel(channel);
    };
  }, [farm.id, initialAnimals]);

  return (
    <main className="min-h-screen bg-[#f5f8f3] text-[#183d2c]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-[#e1e9df] bg-white px-5 py-6 transition-transform lg:translate-x-0 ${
          mobileNav ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <BrandMark />
            PashuRaksha
          </Link>
          <button
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
            className="rounded-md p-1.5 text-[#617166] hover:bg-[#f5f8f3] lg:hidden"
          >
            <Icon type="close" />
          </button>
        </div>

        <p className="mt-10 px-3 text-[10px] font-semibold tracking-[.16em] text-[#91a092]">FARM WORKSPACE</p>

        <nav className="mt-3 space-y-1">
          {navItems.map(([label, id, iconType]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setMobileNav(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                id === "overview"
                  ? "bg-[#eaf2e7] font-medium text-[#216644]"
                  : "text-[#617166] hover:bg-[#f5f8f3] hover:text-[#216644]"
              }`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${id === "overview" ? "bg-white text-[#216644]" : "bg-[#e9f2e7] text-[#35754c]"}`}>
                <Icon type={iconType} />
              </span>
              {label}
              {id === "alerts" && activeAlerts.length > 0 && (
                <span className="ml-auto rounded-full bg-[#f5e5bd] px-2 py-0.5 text-[10px] font-medium text-[#725514]">
                  {activeAlerts.length}
                </span>
              )}
            </a>
          ))}
        </nav>

        <div className="mt-auto rounded-xl bg-[#f2f6ef] p-4">
          <p className="text-xs font-semibold text-[#315946]">Need a hand?</p>
          <p className="mt-1.5 text-xs leading-5 text-[#718073]">
            Connect your IoT device to start seeing live health readings here.
          </p>
          <a href="mailto:hello@pashuraksha.in" className="mt-3 inline-block text-xs font-semibold text-[#34704c]">
            Contact support →
          </a>
        </div>

        <form action={signOut} className="mt-5">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[#617166] hover:bg-[#f5f8f3]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e9f2e7] text-[#34704c]">
              <Icon type="logout" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[13px] font-medium text-[#315946]">{user.name}</b>
              <small className="block truncate text-[11px] text-[#879387]">{user.email}</small>
            </span>
          </button>
        </form>
      </aside>

      {mobileNav && (
        <button
        aria-label="Close navigation"
        className="fixed inset-0 z-30 bg-[#183d2c]/20 lg:hidden"
        onClick={() => setMobileNav(false)}
      />
      )}

      <div className="min-h-screen lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#e1e9df] bg-[#f8faf6]/95 px-5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
              className="rounded-md p-2 text-[#315946] hover:bg-[#e9f2e7] lg:hidden"
            >
              <Icon type="menu" />
            </button>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#839083]">Farm dashboard</p>
              <p className="text-sm font-semibold text-[#315946]">{farm.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium sm:inline-flex ${
              live ? "bg-[#e7f2e5] text-[#347247]" : "bg-[#efeee8] text-[#6e756c]"
            }`}
            >
              <i className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-[#4a9a5a]" : "bg-[#aaa99c]"}`} />
              {live ? "Live updates on" : "Waiting for device"}
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#216644] text-xs font-semibold text-white">
              {initials(user.name)}
            </span>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9">
          <section id="overview" className="scroll-mt-24">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-medium text-[#3f7650]">{greeting()}, {user.name.split(" ")[0]}</p>
                <h1 className="mt-1.5 text-2xl font-semibold tracking-[-.04em] sm:text-[2rem]">
                  Here’s your herd at a glance.
                </h1>
                <p className="mt-2 text-sm text-[#718073]">
                  A practical read on animal health, activity and what may need your attention.
                </p>
              </div>
              <p className="text-xs text-[#879387]">
                {new Date().toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>

            {dataError && (
              <p role="alert" className="mt-5 rounded-lg border border-[#efd2c9] bg-[#fff4ef] px-4 py-3 text-sm text-[#8e3c2c]">
                Some farm records could not be loaded. Check your Supabase migration and row access policies.
              </p>
            )}

            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Animals in your herd" value={animals.length} note="Registered on this farm" tone="green" icon="herd" />
              <Metric label="Looking well" value={Math.max(animals.length - needsAttention, 0)} note="Based on latest readings" tone="mint" icon="check" />
              <Metric label="Needs a check" value={needsAttention} note="Temperature or status flagged" tone="amber" icon="alert" />
              <Metric label="Open alerts" value={activeAlerts.length} note="Unresolved notifications" tone="neutral" icon="bell" />
            </div>
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <section className="rounded-xl border border-[#e1e9df] bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Health trend</p>
                  <p className="mt-1 text-xs text-[#829083]">Recent body temperature readings · °C</p>
                </div>
                <span className="rounded-md bg-[#f2f6ef] px-2.5 py-1.5 text-[10px] font-medium text-[#526b57]">
                  Latest 12 readings
                </span>
              </div>
              <TemperatureChart readings={readings} />
              <div className="mt-3 flex items-center gap-2 text-[11px] text-[#7d8c7e]">
                <i className="h-2 w-2 rounded-full bg-[#55945d]" />
                Temperature readings
                <span className="ml-auto">Reference range: 38.0–39.4°C</span>
              </div>
            </section>

            <section id="alerts" className="scroll-mt-24 rounded-xl border border-[#e1e9df] bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Needs attention</p>
                  <p className="mt-1 text-xs text-[#829083]">Recent alerts from your farm</p>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#fbf3df] text-[#9a741a]">
                  <Icon type="alert" />
                </span>
              </div>
              <div className="mt-4 space-y-2.5">
                {activeAlerts.length
                  ? activeAlerts.slice(0, 4).map((alert) => (
                      <AlertRow
                        key={alert.id}
                        alert={alert}
                        animal={animals.find((item) => item.id === alert.animal_id)}
                      />
                    ))
                  : needsAttention
                  ? animals
                      .filter((animal) => latestByAnimal.get(animal.id)?.temperature_c >= 39.5)
                      .slice(0, 4)
                      .map((animal) => <AlertRow key={animal.id} animal={animal} synthetic />)
                  : (
                    <div className="rounded-lg bg-[#f4f8f1] p-4">
                      <p className="text-sm font-medium text-[#315946]">Nothing needs your attention right now</p>
                      <p className="mt-1 text-xs leading-5 text-[#718073]">
                        New alerts will appear here if a reading is outside its expected range.
                      </p>
                    </div>
                  )}
              </div>
            </section>
          </div>

          <section id="herd" className="mt-5 scroll-mt-24 rounded-xl border border-[#e1e9df] bg-white p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold">Your herd</p>
                <p className="mt-1 text-xs text-[#829083]">Animal profiles and their latest available status</p>
              </div>
              <span className="rounded-md border border-[#dce6dc] px-2.5 py-1.5 text-xs text-[#617166]">
                {animals.length} {animals.length === 1 ? "animal" : "animals"}
              </span>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-y border-[#edf1eb] text-[10px] uppercase tracking-wider text-[#899589]">
                    <th className="py-3 pl-2 font-medium">Animal</th>
                    <th className="py-3 font-medium">Latest temperature</th>
                    <th className="py-3 font-medium">Heart rate</th>
                    <th className="py-3 font-medium">Activity</th>
                    <th className="py-3 pr-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {animals.map((animal) => (
                    <AnimalRow key={animal.id} animal={animal} reading={latestByAnimal.get(animal.id)} />
                  ))}
                </tbody>
              </table>
              {!animals.length && (
                <div className="py-10 text-center">
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#e9f2e7] text-[#34704c]">
                    <Icon type="herd" />
                  </span>
                  <p className="mt-3 text-sm font-semibold">Start with your first animal</p>
                  <p className="mt-1 text-xs text-[#829083]">
                    Add a profile now, then connect a device to see its readings.
                  </p>
                </div>
              )}
            </div>

            <details className="mt-4 rounded-lg border border-dashed border-[#cbdac9] bg-[#fbfcfa] p-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-[#34704c]">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-[#e9f2e7] text-[#34704c]">
                  <Icon type="plus" />
                </span>
                Add an animal to the herd
              </summary>
              <form action={addAction} className="mt-4 grid gap-3 sm:grid-cols-3">
                <input
                  required
                  name="name"
                  placeholder="Animal name"
                  className="rounded-lg border border-[#d6e1d5] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6f9c73] focus:ring-4 focus:ring-[#dcebd7]/70"
                />
                <input
                  required
                  name="tag"
                  placeholder="ID tag (e.g. PR-021)"
                  className="rounded-lg border border-[#d6e1d5] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6f9c73] focus:ring-4 focus:ring-[#dcebd7]/70"
                />
                <div className="flex gap-2">
                  <input
                    name="breed"
                    placeholder="Breed (optional)"
                    className="min-w-0 flex-1 rounded-lg border border-[#d6e1d5] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6f9c73] focus:ring-4 focus:ring-[#dcebd7]/70"
                  />
                  <button
                    disabled={adding}
                    className="rounded-lg bg-[#216644] px-4 text-sm font-medium text-white transition hover:bg-[#194f34] disabled:opacity-70"
                  >
                    {adding ? "Adding…" : "Add"}
                  </button>
                </div>
                {addState?.error && (
                  <p role="alert" className="text-xs text-[#9b4938] sm:col-span-3">
                    {addState.error}
                  </p>
                )}
                {addState?.success && (
                  <p role="status" className="text-xs text-[#347247] sm:col-span-3">
                    {addState.success} Refresh to see the updated profile.
                  </p>
                )}
              </form>
            </details>
          </section>

          <section id="history" className="mt-5 scroll-mt-24 rounded-xl border border-[#e1e9df] bg-white p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-semibold">Health history</p>
                <p className="mt-1 text-xs text-[#829083]">A record of the latest readings received from your devices</p>
              </div>
              <span className="text-[10px] text-[#879387]">Most recent first</span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left">
                <thead>
                  <tr className="border-y border-[#edf1eb] text-[10px] uppercase tracking-wider text-[#899589]">
                    <th className="py-3 pl-2 font-medium">Time recorded</th>
                    <th className="py-3 font-medium">Animal</th>
                    <th className="py-3 font-medium">Temperature</th>
                    <th className="py-3 font-medium">Heart rate</th>
                    <th className="py-3 pr-2 font-medium">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.slice(0, 8).map((reading) => (
                    <HistoryRow
                      key={reading.id}
                      reading={reading}
                      animal={animals.find((item) => item.id === reading.animal_id)}
                    />
                  ))}
                </tbody>
              </table>
              {!readings.length && (
                <div className="py-9 text-center text-sm text-[#829083]">
                  No readings have arrived yet. Your device readings will appear here automatically.
                </div>
              )}
            </div>
          </section>

          <footer className="flex flex-col gap-2 py-7 text-[11px] text-[#899589] sm:flex-row sm:justify-between">
            <span>Private farm workspace · Data access protected by Supabase policies</span>
            <span>{user.email}</span>
          </footer>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value, note, tone, icon }) {
  const colors = {
    green: "bg-[#edf4e9] text-[#39754a]",
    mint: "bg-[#eaf5ef] text-[#347247]",
    amber: "bg-[#fbf3df] text-[#967116]",
    neutral: "bg-[#eff1eb] text-[#637160]",
  };
  return (
    <article className="rounded-xl border border-[#e1e9df] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#718073]">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${colors[tone]}`}>
          <Icon type={icon} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[10px] text-[#899589]">{note}</p>
    </article>
  );
}

function TemperatureChart({ readings }) {
  const points = readings
    .filter((reading) => reading.temperature_c != null)
    .slice(0, 12)
    .reverse();
  if (points.length < 2)
    return (
      <div className="mt-6 grid h-48 place-items-center rounded-lg bg-[#fbfcfa] text-center">
        <div>
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#edf4e9] text-[#39754a]">
            <Icon type="history" />
          </span>
          <p className="mt-2 text-sm font-medium text-[#526b57]">Waiting for enough readings</p>
          <p className="mt-1 text-xs text-[#899589]">
            A temperature trend appears after your device sends data.
          </p>
        </div>
      </div>
    );
  const values = points.map((point) => Number(point.temperature_c));
  const min = Math.min(36, ...values) - 0.5;
  const max = Math.max(41, ...values) + 0.5;
  const coords = values.map(
    (value, index) => `${30 + index * (660 / (values.length - 1))},${170 - ((value - min) / (max - min)) * 145}`
  );
  const area = `30,170 ${coords.join(" ")} 690,170`;
  return (
    <div className="mt-5">
      <svg
        viewBox="0 0 720 205"
        role="img"
        aria-label="Temperature readings over time"
        className="h-[205px] w-full overflow-visible"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#76a96d" stopOpacity=".2" />
            <stop offset="1" stopColor="#76a96d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[50, 100, 150].map((y) => (
          <line key={y} x1="28" x2="694" y1={y} y2={y} stroke="#edf1eb" strokeDasharray="4 5" />
        ))}
        <polygon points={area} fill="url(#trend-fill)" />
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke="#57905f"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((coordinate, index) => {
          const [x, y] = coordinate.split(",");
          return (
            <circle key={points[index].id} cx={x} cy={y} r="4.5" fill="white" stroke="#57905f" strokeWidth="2.5">
              <title>{`${values[index].toFixed(1)}°C · ${formatTime(points[index].recorded_at)}`}</title>
            </circle>
          );
        })}
        <text x="2" y="54" className="fill-[#9aa59a] text-[10px]">41°</text>
        <text x="2" y="104" className="fill-[#9aa59a] text-[10px]">39°</text>
        <text x="2" y="154" className="fill-[#9aa59a] text-[10px]">37°</text>
        <text x="28" y="198" className="fill-[#9aa59a] text-[10px]">
          {formatShortDate(points[0].recorded_at)}
        </text>
        <text x="694" y="198" textAnchor="end" className="fill-[#9aa59a] text-[10px]">
          {formatShortDate(points.at(-1).recorded_at)}
        </text>
      </svg>
    </div>
  );
}

function AnimalRow({ animal, reading }) {
  const warning = animal.status === "needs_attention" || Number(reading?.temperature_c) >= 39.5;
  return (
    <tr className="border-b border-[#f0f3ee] text-xs last:border-0">
      <td className="py-3.5 pl-2">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eef4eb] text-[#39754a]">
            <Icon type="herd" />
          </span>
          <span>
            <b className="block font-medium text-[#315946]">{animal.name}</b>
            <small className="mt-0.5 block text-[#899589]">
              {animal.tag}
              {animal.breed ? ` · ${animal.breed}` : ""}
            </small>
          </span>
        </div>
      </td>
      <td className="py-3.5 text-[#526b57]">
        {reading?.temperature_c == null ? "—" : `${Number(reading.temperature_c).toFixed(1)} °C`}
      </td>
      <td className="py-3.5 text-[#526b57]">
        {reading?.heart_rate_bpm == null ? "—" : `${reading.heart_rate_bpm} bpm`}
      </td>
      <td className="py-3.5 text-[#526b57]">
        {reading?.activity_level == null ? "—" : `${reading.activity_level}%`}
      </td>
      <td className="py-3.5 pr-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
            warning
              ? "bg-[#fbf3df] text-[#967116]"
              : reading
              ? "bg-[#eaf5ef] text-[#347247]"
              : "bg-[#eff1eb] text-[#748071]"
          }`}
        >
          {warning ? "Check needed" : reading ? "Looking well" : "No readings yet"}
        </span>
      </td>
    </tr>
  );
}

function AlertRow({ alert, animal, synthetic = false }) {
  const title = synthetic ? "Temperature above usual range" : alert.title;
  const message = synthetic
    ? `${animal.name} has a high recent temperature reading.`
    : alert.message;
  return (
    <article className="flex gap-3 rounded-lg border border-[#f1ead8] bg-[#fffdf7] p-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#fbf0d4] text-[#967116]">
        <Icon type="alert" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-[#4e4b3c]">{title || "Health alert"}</p>
          <time className="shrink-0 text-[9px] text-[#9a9687]">
            {!synthetic && formatTime(alert.created_at)}
          </time>
        </div>
        <p className="mt-1 text-[10px] leading-4 text-[#7a7566]">
            {(message || "Please review this animal’s latest reading.")}
            {animal ? ` · ${animal.name}` : ""}
          </p>
      </div>
    </article>
  );
}

function HistoryRow({ reading, animal }) {
  return (
    <tr className="border-b border-[#f0f3ee] text-xs last:border-0">
      <td className="py-3.5 pl-2 text-[#718073]">{formatTime(reading.recorded_at)}</td>
      <td className="py-3.5 font-medium text-[#315946]">
        {animal?.name || "Animal"}{" "}
        <span className="font-normal text-[#899589]">{animal?.tag}</span>
      </td>
      <td className="py-3.5 text-[#526b57]">
        {reading.temperature_c == null ? "—" : `${Number(reading.temperature_c).toFixed(1)} °C`}
      </td>
      <td className="py-3.5 text-[#526b57]">
        {reading.heart_rate_bpm == null ? "—" : `${reading.heart_rate_bpm} bpm`}
      </td>
      <td className="py-3.5 pr-2 text-[#526b57]">
        {reading.activity_level == null ? "—" : `${reading.activity_level}%`}
      </td>
    </tr>
  );
}

function initials(name = "F") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function formatTime(value) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatShortDate(value) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}
