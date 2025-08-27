// src/app/api/scripts/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { adminAuth } from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getPerformance } from "firebase/performance";
import { trace } from "firebase/performance";

// ⚠️ Importa el SDK de Performance para Node
import { getPerformance as getNodePerformance } from "firebase/performance/node";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Instancia de performance en el **backend**
const perf = getNodePerformance(app);

type UsageResp = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export async function POST(req: NextRequest) {
  const idem = req.headers.get("x-idempotency-key") || randomUUID();
  const simulate = process.env.SIMULATE === "true";

  // 👉 Creamos una traza personalizada
  const traceSpan = perf.trace("api_scripts_create");

  try {
    traceSpan.start(); // ⏱️ Start

    // 1) Auth
    const authHeader = req.headers.get("authorization") || "";
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      traceSpan.recordException({ message: "No auth" });
      traceSpan.stop();
      return NextResponse.json({ error: "No auth" }, { status: 401 });
    }
    const idToken = m[1];

    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    const uid = decoded?.uid;
    if (!uid) {
      traceSpan.recordException({ message: "No uid" });
      traceSpan.stop();
      return NextResponse.json({ error: "No uid" }, { status: 401 });
    }

    // 2) Body
    const body = await req.json();
    traceSpan.putAttribute("platform", body.platform || "unknown");
    traceSpan.putAttribute("language", body.language || "unknown");

    const {
      description,
      tone,
      platform,
      duration,
      language,
      structure,
      addCTA,
      ctaText,
    } = body;

    if (!description || !tone || !platform || !duration || !language || !structure) {
      traceSpan.recordException({ message: "Missing fields" });
      traceSpan.stop();
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    let script = "";

    // 🔔 Evento: inicio de generación
    await gaServerEvent(
      "script_generate_started",
      { simulate, description, tone, platform, duration, language },
      { userId: uid }
    );

    if (simulate) {
      script = `Este es un guion simulado para el tema "${description}" ...`;
    } else {
      const prompt = `...`;
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
        max_tokens: 500,
      });

      script =
        completion.choices[0]?.message?.content
          ?.replace(/^["'\s]+|["'\s]+$/g, "")
          .replace(/^(Aquí.*?:\s*)/i, "")
          .trim() || "";
    }

    // 5) Cobrar uso
    const usageRes = await fetch(
      new URL("/api/billing/usage", req.nextUrl.origin),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          "X-Idempotency-Key": idem,
        },
        body: JSON.stringify({ kind: "script", quantity: 1, idem }),
      }
    );

    let usage: UsageResp = {};
    try {
      usage = (await usageRes.json()) as UsageResp;
    } catch {}

    if (!usageRes.ok || usage.ok !== true) {
      const msg = usage.message || usage.error || `usage status ${usageRes.status}`;
      throw new Error(msg);
    }

    // 🔔 Evento: completado
    await gaServerEvent(
      "script_generate_completed",
      { length: script.length, simulated: simulate },
      { userId: uid }
    );

    traceSpan.stop(); // ✅ End trace
    return NextResponse.json({ script, simulated: simulate });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno generando guion";

    traceSpan.recordException({ message: msg });
    traceSpan.stop(); // ❌ cerrar siempre el trace

    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/, "");
    let uid: string | undefined;
    if (idToken) {
      const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
      uid = decoded?.uid;
    }
    await gaServerEvent(
      "script_generate_failed",
      { error: msg },
      uid ? { userId: uid } : undefined
    );

    const isAuth = /No auth|No uid/i.test(msg);
    return NextResponse.json({ error: msg }, { status: isAuth ? 401 : 500 });
  }
}
