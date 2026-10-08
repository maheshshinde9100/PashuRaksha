"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
      : type === "thermo"
      ? <><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" /></>
      : type === "health"
      ? <><path d="M12 21s-7.5-4.6-7.5-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3C19.5 16.4 12 21 12 21z" /></>
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
];

function deriveHealth(reading) {
  if (!reading) return { label: "Awaiting data", tone: "neutral", note: "No recent reading" };
  const t = reading.temperature_c;
  const m = reading.motion_pct ?? reading.activity_level;
  const hr = reading.heart_rate_bpm;
  const h = reading.humidity_pct;

  const issues = [];
  let maxLevel = 0;

  if (t != null) {
    if (t >= 40.5) { issues.push("Very high temp"); maxLevel = Math.max(maxLevel, 3); }
    else if (t >= 39.6) { issues.push("High temperature"); maxLevel = Math.max(maxLevel, 2); }
    else if (t < 37.0) { issues.push("Low temperature"); maxLevel = Math.max(maxLevel, 2); }
  }

  if (h != null) {
    if (h >= 95) { issues.push("Extreme humidity"); maxLevel = Math.max(maxLevel, 3); }
    else if (h >= 85) { issues.push("High humidity stress"); maxLevel = Math.max(maxLevel, 2); }
  }

  if (m != null) {
    if (m >= 85) { issues.push("Heavy restlessness"); maxLevel = Math.max(maxLevel, 2); }
    else if (m >= 60) { issues.push("Elevated movement"); maxLevel = Math.max(maxLevel, 1); }
    else if (m <= 1) { issues.push("Very low movement"); maxLevel = Math.max(maxLevel, 1); }
  }

  if (hr != null && hr > 0) {
    if (hr >= 110) { issues.push("Very high HR"); maxLevel = Math.max(maxLevel, 3); }
    else if (hr >= 90) { issues.push("High heart rate"); maxLevel = Math.max(maxLevel, 2); }
    else if (hr < 40) { issues.push("Low heart rate"); maxLevel = Math.max(maxLevel, 2); }
  }

  if (maxLevel === 0) return { label: "Looking well", tone: "good", note: "Vitals in range" };
  if (maxLevel === 1) return { label: "Monitor", tone: "info", note: issues.join(" · ") };
  if (maxLevel === 2) return { label: "Check needed", tone: "warning", note: issues.join(" · ") };
  return { label: "Alert", tone: "critical", note: issues.join(" · ") };
}

export default function DashboardClient({ user, farm, initialReadings, initialAnimals, initialAlerts, initialError }) {
  const [addState, addAction, adding] = useActionState(addAnimal, null);
  const [mobileNav, setMobileNav] = useState(false);
  const [readings, setReadings] = useState(initialReadings);
  const baseAnimals = useMemo(() => {
    if (!addState?.animal) return initialAnimals;
    const next = [addState.animal, ...initialAnimals.filter((x) => x.id !== addState.animal.id)];
    next.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return next;
  }, [initialAnimals, addState]);
  const animals = baseAnimals;
  const animalsRef = useRef(animals);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [dataError] = useState(initialError);
  const [live, setLive] = useState(false);
  const [liveSince, setLiveSince] = useState(null);
  const [fresh, setFresh] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => { animalsRef.current = animals; }, [animals]);

  const latestByAnimal = useMemo(() => {
    const byAnimal = new Map();
    for (const reading of readings) {
      if (!byAnimal.has(reading.animal_id)) byAnimal.set(reading.animal_id, reading);
    }
    return byAnimal;
  }, [readings]);

  const activeAlerts = useMemo(() => alerts.filter((alert) => !alert.resolved_at), [alerts]);
  const alertsByAnimal = useMemo(() => {
    const byId = new Map();
    for (const alert of activeAlerts) {
      if (!byId.has(alert.animal_id)) byId.set(alert.animal_id, []);
      byId.get(alert.animal_id).push(alert);
    }
    return byId;
  }, [activeAlerts]);

  const { healthyCount, attentionCount, criticalCount } = useMemo(() => {
    let h = 0; let a = 0; let c = 0;
    animals.forEach((animal) => {
      const r = latestByAnimal.get(animal.id);
      const { tone } = deriveHealth(r);
      if (tone === "critical") c++;
      else if (tone === "warning" || tone === "info" || animal.status === "needs_attention") a++;
      else h++;
    });
    const directAttention = animals.filter((x) => x.status === "needs_attention").length;
    const finalAttention = Math.max(a, directAttention);
    const finalHealthy = Math.max(h, animals.length - finalAttention - c);
    return {
      healthyCount: Math.max(0, finalHealthy),
      attentionCount: finalAttention,
      criticalCount: c,
    };
  }, [animals, latestByAnimal]);

  useEffect(() => { if (fresh) { const t = setTimeout(() => setFresh(false), 1400); return () => clearTimeout(t); } }, [fresh]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const freshnessText = useMemo(() => {
    const newest = readings[0]?.recorded_at;
    const currentTime = nowMs;
    if (!newest) return live ? "Live · on" : "Waiting for device data";
    const secs = Math.max(0, Math.floor((currentTime - new Date(newest).getTime()) / 1000));
    if (!live) return `${secs < 60 ? `Last data ${secs}s ago` : formatAgo(newest, currentTime)}`;
    if (secs < 5) return "Live · updated <5s ago";
    if (secs < 60) return `Live · updated ${secs}s ago`;
    if (secs < 3600) return `Live · ${Math.floor(secs / 60)}m ago`;
    return "Live · on";
  }, [readings, live, nowMs]);

  useEffect(() => {
    if (!initialAnimals.length) return undefined;
    let channel;
    try {
      const supabase = createClient();
      channel = supabase
        .channel(`farm-live-${farm.id}`, {
          config: { broadcast: { ack: false }, presence: { key: "" } },
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "sensor_readings" }, ({ new: row }) => {
          const set = new Set(animalsRef.current.map((x) => x.id));
          if (!set.has(row.animal_id)) return;
          setReadings((now) => {
            const next = [row, ...now.filter((item) => item.id !== row.id)];
            return next.length > 400 ? next.slice(0, 400) : next;
          });
          setFresh(true);
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, ({ new: row }) => {
          if (row.farm_id !== farm.id) return;
          setAlerts((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 40));
          setFresh(true);
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "alerts" }, ({ new: row }) => {
          if (row.farm_id !== farm.id) return;
          setAlerts((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 40));
          setFresh(true);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") { setLive(true); setLiveSince(Date.now()); }
          else setLive(false);
        });
    } catch {
      channel = null;
    }
    return () => { if (channel) try { createClient().removeChannel(channel); } catch {} };
  }, [farm.id, initialAnimals.length]);

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
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  activeAlerts.some((a) => a.severity === "critical")
                    ? "bg-[#f5d9cf] text-[#8e3c2c]"
                    : "bg-[#f5e5bd] text-[#725514]"
                }`}>
                  {activeAlerts.length}
                </span>
              )}
            </a>
          ))}
        </nav>

        <form action={signOut} className="mt-auto">
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
              className={`hidden items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-medium sm:inline-flex ${
                fresh ? "border-[#cde5c4] bg-[#e7f2e5] text-[#2f7a4b]" :
                live ? "border-[#d7e3d1] bg-[#e9f2e4] text-[#347247]" : "border-[#e3e2d7] bg-[#efeee8] text-[#6e756c]"
              } transition-colors`}
            >
              <i className={`h-1.5 w-1.5 rounded-full ${
                fresh ? "animate-ping bg-[#4a9a5a] opacity-100" :
                live ? "bg-[#4a9a5a]" : "bg-[#aaa99c]"
              } ${fresh ? "" : live ? "animate-pulse" : ""}`} />
              <span className="flex items-center gap-2">
                {fresh ? "Just received a new reading" : freshnessText}
              </span>
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
                  Your herd health at a glance.
                </h1>
                <p className="mt-2 text-sm text-[#718073]">
                  Temperature, motion and heart rate are evaluated in real time; unusual readings raise alerts automatically.
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
              <Metric label="Looking well" value={healthyCount} note="Vitals in reference range" tone="mint" icon="check" />
              <Metric label="Needs a check" value={attentionCount} note="Monitor or treat soon" tone="amber" icon="alert" />
              <Metric label="Critical / open alerts" value={criticalCount + activeAlerts.filter((a) => a.severity === "critical").length} note="Unresolved / severe" tone="red" icon="bell" />
            </div>
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <section className="rounded-xl border border-[#e1e9df] bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Body temperature trend</p>
                  <p className="mt-1 text-xs text-[#829083]">Recent sensor readings · °C</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-md bg-[#f2f6ef] px-2.5 py-1.5 text-[10px] font-medium text-[#526b57]">
                  <Icon type="thermo" /> Latest 24 readings
                </span>
              </div>
              <TemperatureChart readings={readings} />
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#7d8c7e]">
                <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#55945d]" /> Temperature</span>
                <span>Reference: 38.0–39.5 °C</span>
                {latestByAnimal.size > 0 && <span className="ml-auto">Latest samples: {readings.length}</span>}
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
                  ? activeAlerts.slice(0, 6).map((alert) => (
                      <AlertRow
                        key={alert.id}
                        alert={alert}
                        animal={animals.find((item) => item.id === alert.animal_id)}
                      />
                    ))
                  : (
                    <div className="rounded-lg bg-[#f4f8f1] p-4">
                      <p className="text-sm font-medium text-[#315946]">Nothing needs your attention right now</p>
                      <p className="mt-1 text-xs leading-5 text-[#718073]">
                        Alerts will appear here when temperature, motion, or heart rate move outside the healthy range.
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
                <p className="mt-1 text-xs text-[#829083]">Animal profiles with derived health status from device data</p>
              </div>
              <span className="rounded-md border border-[#dce6dc] px-2.5 py-1.5 text-xs text-[#617166]">
                {animals.length} {animals.length === 1 ? "animal" : "animals"}
              </span>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead>
                  <tr className="border-y border-[#edf1eb] bg-[#f9fbf7] text-[11px] uppercase tracking-[.12em] text-[#879688]">
                    <th className="py-4 pl-3 font-semibold sm:pl-4">Animal</th>
                    <th className="py-4 font-semibold">Temperature</th>
                    <th className="py-4 font-semibold">Heart rate</th>
                    <th className="py-4 font-semibold">Motion</th>
                    <th className="py-4 font-semibold">Health status</th>
                    <th className="py-4 pr-3 text-right font-semibold sm:pr-4">Last sample</th>
                  </tr>
                </thead>
                <tbody>
                  {animals.map((animal) => (
                    <AnimalRow
                      key={animal.id}
                      animal={animal}
                      reading={latestByAnimal.get(animal.id)}
                      alerts={alertsByAnimal.get(animal.id) || []}
                      flash={fresh && Boolean(latestByAnimal.get(animal.id) && readings[0]?.animal_id === animal.id)}
                      nowMs={nowMs}
                    />
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
                    Add the animal profile now. The ID tag you enter (e.g. PR-001) must match <code className="rounded bg-[#f7f9f5] px-1 py-0.5">animal_tag</code> sent by the device.
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
                  placeholder="Animal name (e.g. Ganga)"
                  className="rounded-lg border border-[#d6e1d5] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6f9c73] focus:ring-4 focus:ring-[#dcebd7]/70"
                />
                <input
                  required
                  name="tag"
                  placeholder="ID tag — must match device (e.g. PR-001)"
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
                    {addState.success}
                  </p>
                )}
              </form>
            </details>
          </section>

          <footer className="flex flex-col gap-2 py-7 text-[11px] text-[#899589] sm:flex-row sm:justify-between">
            <span>Private farm workspace · Device ingest keyed by animal tag</span>
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
    red: "bg-[#fae6dd] text-[#8e3c2c]",
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
    .filter((r) => r.temperature_c != null)
    .slice(0, 24)
    .reverse();
  if (points.length < 2)
    return (
      <div className="mt-6 grid h-48 place-items-center rounded-lg bg-[#fbfcfa] text-center">
        <div>
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#edf4e9] text-[#39754a]">
            <Icon type="thermo" />
          </span>
          <p className="mt-2 text-sm font-medium text-[#526b57]">Waiting for temperature samples</p>
          <p className="mt-1 text-xs text-[#899589]">
            A trend appears once the device sends a few readings via the telemetry API.
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

  const refLowY = 170 - ((38.0 - min) / (max - min)) * 145;
  const refHighY = 170 - ((39.5 - min) / (max - min)) * 145;

  return (
    <div className="mt-5">
      <svg viewBox="0 0 720 205" role="img" aria-label="Temperature readings over time" className="h-[205px] w-full overflow-visible">
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#76a96d" stopOpacity=".2" />
            <stop offset="1" stopColor="#76a96d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[50, 100, 150].map((y) => (
          <line key={y} x1="28" x2="694" y1={y} y2={y} stroke="#edf1eb" strokeDasharray="4 5" />
        ))}
        <line x1="30" x2="694" y1={refHighY} y2={refHighY} stroke="#f5d0ba" strokeDasharray="3 4" />
        <line x1="30" x2="694" y1={refLowY} y2={refLowY} stroke="#d8ead6" strokeDasharray="3 4" />
        <polygon points={area} fill="url(#trend-fill)" />
        <polyline points={coords.join(" ")} fill="none" stroke="#57905f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((coordinate, index) => {
          const [x, y] = coordinate.split(",");
          const value = values[index];
          const warn = value >= 39.6 || value < 37.0;
          return (
            <circle key={points[index].id} cx={x} cy={y} r={warn ? 5.5 : 4.2} fill="white" stroke={warn ? "#c4522f" : "#57905f"} strokeWidth="2.5">
              <title>{`${value.toFixed(1)}°C · ${formatTime(points[index].recorded_at)}`}</title>
            </circle>
          );
        })}
        <text x="2" y="54" className="fill-[#9aa59a] text-[10px]">41°</text>
        <text x="2" y="104" className="fill-[#9aa59a] text-[10px]">39°</text>
        <text x="2" y="154" className="fill-[#9aa59a] text-[10px]">37°</text>
        <text x="28" y="198" className="fill-[#9aa59a] text-[10px]">{formatShortDate(points[0].recorded_at)}</text>
        <text x="694" y="198" textAnchor="end" className="fill-[#9aa59a] text-[10px]">{formatShortDate(points.at(-1).recorded_at)}</text>
      </svg>
    </div>
  );
}

function AnimalRow({ animal, reading, alerts = [], flash = false, nowMs = 0 }) {
  const health = deriveHealth(reading);

  const pillTones = {
    good: { wrap: "bg-[#e6f4ec] text-[#2b6b43]", ring: "ring-[#d9eadf]" },
    info: { wrap: "bg-[#eef3f9] text-[#2f5a85]", ring: "ring-[#dbe5f2]" },
    warning: { wrap: "bg-[#fbf3df] text-[#856216]", ring: "ring-[#f1e7c8]" },
    critical: { wrap: "bg-[#fbe2d4] text-[#7f3325]", ring: "ring-[#f4ccb6]" },
    neutral: { wrap: "bg-[#eff1eb] text-[#5d6b5a]", ring: "ring-[#e5eadc]" },
  }[health.tone] || { wrap: "bg-[#eff1eb] text-[#5d6b5a]", ring: "ring-[#e5eadc]" };

  const valueTones = {
    good: "text-[#315946]",
    info: "text-[#2f5a85]",
    warning: "text-[#8a5d0f]",
    critical: "text-[#7f3325]",
    neutral: "text-[#526b57]",
  }[health.tone] || "text-[#526b57]";

  const statusReasons = (() => {
    const out = [];
    if (alerts.length) {
      const titles = alerts
        .slice(0, 2)
        .map((a) => (a.title || "").trim())
        .filter(Boolean);
      if (titles.length) out.push(...titles);
    } else if (health.note) {
      out.push(health.note);
    }
    return out.slice(0, 2);
  })();

  const temperature = reading?.temperature_c;
  const heartRate = reading?.heart_rate_bpm;
  const motion = reading?.motion_pct ?? reading?.activity_level;

  return (
    <tr className={`border-b border-[#eef3ec] last:border-0 transition-colors ${
      flash ? "bg-[#f2fbf0]" : ""
    }`}>
      <td className="py-5 pl-3 sm:pl-4">
        <div className="flex items-center gap-3.5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e9f2e7] text-[#34704c]">
            <Icon type="herd" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-tight text-[#22432e]">{animal.name}</p>
            <p className="mt-0.5 truncate text-[12px] text-[#829083]">
              <span className="font-medium text-[#667a67]">{animal.tag}</span>
              {animal.breed ? <span className="mx-1 text-[#b0bdb1]">·</span> : null}
              {animal.breed ? <span>{animal.breed}</span> : null}
            </p>
          </div>
        </div>
      </td>

      <td className="py-5">
        <div className="flex flex-col">
          <span className={`text-[20px] font-semibold leading-tight ${
            temperature != null && (Number(temperature) < 37 || Number(temperature) >= 39.6)
              ? "text-[#8a5d0f]"
              : "text-[#2f6b46]"
          }`}>
            {temperature == null ? "—" : `${Number(temperature).toFixed(1)}°`}
          </span>
          <span className="mt-1 text-[11px] text-[#899589]">Temperature</span>
        </div>
      </td>

      <td className="py-5">
        <div className="flex flex-col">
          <span className={`text-[20px] font-semibold leading-tight ${
            heartRate != null && (Number(heartRate) < 40 || Number(heartRate) > 95)
              ? "text-[#7f3325]"
              : "text-[#2f6b46]"
          }`}>
            {heartRate == null ? "—" : `${Number(heartRate).toFixed(0)}`}
          </span>
          <span className="mt-1 text-[11px] text-[#899589]">Heart rate · bpm</span>
        </div>
      </td>

      <td className="py-5">
        <div className="flex flex-col">
          <span className={`text-[20px] font-semibold leading-tight ${valueTones}`}>
            {motion == null ? "—" : `${Number(motion).toFixed(0)}%`}
          </span>
          <span className="mt-1 text-[11px] text-[#899589]">Motion</span>
        </div>
      </td>

      <td className="py-5">
        <div className="flex flex-col gap-2 max-w-[240px]">
          <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ring-inset ${pillTones.wrap} ${pillTones.ring}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
            {health.label}
          </span>
          {statusReasons.length > 0 && (
            <p className="text-[12px] leading-5 text-[#5c6c5d]">
              {statusReasons.join(" · ")}
            </p>
          )}
        </div>
      </td>

      <td className="py-5 pr-3 sm:pr-4 text-right">
        <div className="flex flex-col items-end">
          <time className="text-[14px] font-medium text-[#315946]">
            {reading?.recorded_at ? formatDateTime(reading.recorded_at) : "Waiting"}
          </time>
          {reading?.recorded_at && (
            <span className="mt-1 text-[11px] text-[#899589]">
              {formatAgo(reading.recorded_at, nowMs)}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

function AlertRow({ alert, animal }) {
  const severityColor = {
    critical: "bg-[#fbe2d4] text-[#8e3c2c] border-[#f3c9b3]",
    warning: "bg-[#fffdf7] text-[#7a6233] border-[#f1ead8]",
    info: "bg-[#eef5fb] text-[#2f5a85] border-[#d9e5f2]",
  }[alert?.severity || "warning"] || "bg-[#fbf3df] text-[#967116] border-[#f1ead8]";

  return (
    <article className={`flex gap-3 rounded-lg border ${severityColor} p-3`}>
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/70 text-current">
        <Icon type="alert" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{(alert?.severity || "warning")}</span>
            <p className="text-xs font-semibold text-current">{alert?.title || "Health alert"}</p>
          </div>
          <time className="shrink-0 text-[9px] opacity-80">{alert?.created_at ? formatTime(alert.created_at) : ""}</time>
        </div>
        <p className="mt-1 text-[11px] leading-4 opacity-90">
          {(alert?.message || "Please review this animal’s latest reading.")}{animal ? ` · ${animal.name}` : ""}
        </p>
      </div>
    </article>
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
  });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(/^(\d{2} \w{3}) (\d{2}:\d{2})$/, "$1, $2");
}

function formatAgo(value, currentTime = null) {
  const base = typeof currentTime === "number" ? currentTime : (Date.now ? Date.now() : 0);
  const seconds = Math.max(0, Math.floor((base - new Date(value).getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}${minutes === 1 ? " min" : " mins"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}${days === 1 ? " day" : " days"} ago`;
}

function formatShortDate(value) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}
