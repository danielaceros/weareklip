// src/lib/ga-server.ts
import crypto from "node:crypto";

const MID = process.env.GA4_MEASUREMENT_ID;
const SECRET = process.env.GA4_API_SECRET;

type Params = Record<string, unknown>;

export async function gaServerEvent(name: string, params: Params = {}, opts?: { userId?: string; clientId?: string }) {
  if (!MID || !SECRET) return; // silencioso si no está configurado
  const client_id = opts?.clientId || crypto.randomUUID();
  const payload = {
    client_id,
    user_id: opts?.userId,
    events: [{ name, params }],
  };
  try {
    await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${MID}&api_secret=${SECRET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // no romper el flujo del server
    console.error("GA MP error:", e);
  }
}

