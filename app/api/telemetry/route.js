import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNumber(value, allowNull = true) {
  if (value == null || value === "" || value === "null") return allowNull ? null : undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseInteger(value) {
  const n = parseNumber(value, true);
  if (n == null) return null;
  return Math.round(n);
}

export async function POST(request) {
  const configuredKey = process.env.IOT_TELEMETRY_API_KEY;
  if (!configuredKey) {
    return NextResponse.json(
      { ok: false, error: "Telemetry ingest is not configured on the server." },
      { status: 500 }
    );
  }

  const providedKey = request.headers.get("x-device-api-key");
  if (!providedKey || providedKey !== configuredKey) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid x-device-api-key header." },
      { status: 401 }
    );
  }

  let body;
  try {
    const contentType = (request.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const form = await request.formData();
      body = {};
      for (const [k, v] of form.entries()) body[k] = v;
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Invalid request body: ${err instanceof Error ? err.message : err}` },
      { status: 400 }
    );
  }

  const animalTag = String(body.animal_tag || body.animalTag || "").trim();
  const deviceTag = String(body.device_tag || body.deviceTag || body.device || "").trim();
  if (!animalTag) {
    return NextResponse.json(
      { ok: false, error: 'animal_tag is required. Add this animal on the dashboard first (ID tag = animal_tag).' },
      { status: 400 }
    );
  }

  const temperatureC = parseNumber(body.temperature_c ?? body.temperature);
  const humidityPct = parseNumber(body.humidity_pct ?? body.humidity);
  const heartRateBpm = parseInteger(body.heart_rate_bpm ?? body.heart_rate ?? body.bpm);
  const motionPct = parseNumber(body.motion_pct ?? body.motion ?? body.activity_level);
  const accelXG = parseNumber(body.accel_x_g ?? body.accel_x);
  const accelYG = parseNumber(body.accel_y_g ?? body.accel_y);
  const accelZG = parseNumber(body.accel_z_g ?? body.accel_z);
  const gyroXDps = parseNumber(body.gyro_x_dps ?? body.gyro_x);
  const gyroYDps = parseNumber(body.gyro_y_dps ?? body.gyro_y);
  const gyroZDps = parseNumber(body.gyro_z_dps ?? body.gyro_z);
  const recordedAt = body.recorded_at ? new Date(body.recorded_at).toISOString() : null;

  if (
    temperatureC == null &&
    heartRateBpm == null &&
    motionPct == null &&
    humidityPct == null
  ) {
    return NextResponse.json(
      { ok: false, error: 'At least one measurement is required: temperature_c, humidity_pct, heart_rate_bpm, or motion_pct.' },
      { status: 400 }
    );
  }

  try {
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRole || !url) {
      return NextResponse.json(
        { ok: false, error: 'Server missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
    }

    const supabase = await createClient({ admin: true });

    const { data, error } = await supabase.rpc("insert_telemetry", {
      p_device_tag: deviceTag || null,
      p_animal_tag: animalTag,
      p_temperature_c: temperatureC,
      p_humidity_pct: humidityPct,
      p_heart_rate_bpm: heartRateBpm,
      p_motion_pct: motionPct,
      p_accel_x_g: accelXG,
      p_accel_y_g: accelYG,
      p_accel_z_g: accelZG,
      p_gyro_x_dps: gyroXDps,
      p_gyro_y_dps: gyroYDps,
      p_gyro_z_dps: gyroZDps,
      p_recorded_at: recordedAt || null,
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Supabase RPC failed.",
          code: error.code || null,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, reading: data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
