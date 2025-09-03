import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { adminAuth } from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server";

// ✅ límites y utilidades centralizadas (mismo módulo que usa "create")
import {
  MAX_AUDIO_SECONDS as MAX_SEC,
  WPS,
  estimateTtsSeconds,
} from "@/lib/limits";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  description: string;
  tone: string;
  platform: string;
  duration: string;   // ej: "45-60"
  language: string;   // "es" | "en" | "fr" ...
  structure: string;
  addCTA?: boolean;
  ctaText?: string;
};

// --- helpers ---
function sanitize(input: unknown, max = 200): string {
  return typeof input === "string"
    ? input.replace(/[\r\n]+/g, " ").slice(0, max).trim()
    : "";
}

function parseDurationRange(range: string): [number, number] | null {
  // "0-15" -> [0, 15]
  const m = range?.match?.(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return [Math.min(a, b), Math.max(a, b)];
}

function truncateToWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words
    .slice(0, maxWords)
    .join(" ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

export async function POST(req: NextRequest) {
  const simulate = process.env.SIMULATE === "true";
  const idem = randomUUID();

  try {
    // 1) Auth (acepta 'authorization' o 'Authorization')
    const hdr = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    if (!m) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const idToken = m[1];
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    const uid = decoded?.uid;
    if (!uid) return NextResponse.json({ error: "No uid" }, { status: 401 });

    // 2) Input + sanitización
    const bodyRaw = await req.json();
    const body = bodyRaw as Body;

    const description = sanitize(body.description, 300);
    const tone = sanitize(body.tone, 100);
    const platform = sanitize(body.platform, 50);
    const duration = sanitize(body.duration, 20); // "45-60"
    const language = sanitize(body.language, 10) || "es";
    const structure = sanitize(body.structure, 100);
    const addCTA = !!body.addCTA;
    const ctaText = sanitize(body.ctaText ?? "", 100);

    if (!description || !tone || !platform || !duration || !language || !structure) {
      return NextResponse.json({ error: "Faltan parámetros obligatorios" }, { status: 400 });
    }

    // 2.1) segundos objetivo (capped a 60) + presupuesto de palabras (velocidad 1x)
    const range = parseDurationRange(duration) ?? [0, MAX_SEC];
    const secondsCap = Math.min(range[1], MAX_SEC);
    const wps = WPS[language] ?? 2.5;
    const wordBudget = Math.max(1, Math.floor(wps * secondsCap));

    // 🔔 evento start
    await gaServerEvent(
      "script_regenerate_started",
      { simulate, description, tone, platform, duration, language, secondsCap, wordBudget },
      { userId: uid }
    );

    let regeneratedScript = "";

    // 3) SIMULACIÓN
    if (simulate) {
      regeneratedScript = `Guion simulado (regenerado) (~${secondsCap}s, ~${wordBudget} palabras) para "${description}", tono ${tone}, plataforma ${platform}, idioma ${language}, estructura ${structure}${addCTA ? `, CTA "${ctaText || "Invita a seguir"}"` : ""}.`;
    } else {
      // 4) REAL: prompt con constraints estrictas
      const prompt = `
Eres un copywriter profesional de vídeos cortos. Regenera un GUION ORIGINAL en ${language} para ${platform}.

Parámetros:
- Tema: ${description}
- Tono: ${tone}
- Estructura: ${structure}
- CTA: ${addCTA ? `"${ctaText || "Invita a seguir"}"` : "No incluir si no aporta"}

CONSTRAINTS OBLIGATORIAS:
- Duración objetivo ≈ ${secondsCap} segundos. Máximo absoluto ${MAX_SEC} s.
- PRESUPUESTO DE PALABRAS: NO SUPERE ${wordBudget} palabras (prioriza concisión).
- Frases cortas, naturales, separadas en líneas para locución.
- Gancho potente en las primeras 1–2 líneas.
- No menciones que eres IA. NO incluyas títulos, notas ni comillas.
- Devuelve ÚNICAMENTE el guion final, sin texto extra.
`.trim();

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
        max_tokens: 500,
      });

      regeneratedScript =
        completion.choices[0]?.message?.content
          ?.replace(/^["'\s]+|["'\s]+$/g, "")
          .replace(/^(Aquí.*?:\s*)/i, "")
          .trim() || "";

      // 4.1) Post-procesado defensivo: recorta si excede el presupuesto
      if (regeneratedScript) {
        regeneratedScript = truncateToWords(regeneratedScript, wordBudget).trim();

        // 4.2) Validación de duración estimada (velocidad 1x). Si >60s, recorte extra.
        const estSec = estimateTtsSeconds(regeneratedScript, language, 1);
        if (estSec > MAX_SEC) {
          const hardBudget = Math.max(1, Math.floor(wps * MAX_SEC));
          regeneratedScript = truncateToWords(regeneratedScript, hardBudget).trim();
        }
      }
    }

    // 🔔 evento ok
    await gaServerEvent(
      "script_regenerate_completed",
      { length: regeneratedScript.length, simulated: simulate, secondsCap, wordBudget },
      { userId: uid }
    );

    return NextResponse.json({ script: regeneratedScript, simulated: simulate });
  } catch (error) {
    console.error("❌ Error /scripts/regenerate:", error);
    const msg = error instanceof Error ? error.message : "Error interno regenerando guion";

    // 🔔 evento error
    const hdr = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    if (m) {
      const decoded = await adminAuth.verifyIdToken(m[1]).catch(() => null);
      const uid = decoded?.uid;
      if (uid) {
        try {
          await gaServerEvent("script_regenerate_failed", { error: msg }, { userId: uid });
        } catch {}
      }
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
