import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { adminAuth } from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  description: string;
  tone: string;
  platform: string;
  duration: string;   // "0-15" | "15-30" | "45-60" | "60"
  language: string;   // "es" | "en" | "fr" (o similar)
  structure: string;
  addCTA?: boolean;
  ctaText?: string;
  // opcional: si la UI decide pasar la misma velocidad que usará TTS
  speed?: number;     // clamp 0.7–1.2
};

/** ================== LÍMITES Y ESTIMACIÓN ================== */
const MAX_SEC = 60;
const MIN_SPEED = 0.7;
const MAX_SPEED = 1.2;

type Locale = "es" | "en" | "fr";

const BASE_WPM: Record<Locale, number> = {
  es: 160,
  en: 170,
  fr: 150,
};

const PAUSE_SECONDS = {
  comma: 0.25,
  period: 0.6,
  newline: 0.6,
  colonSemicolon: 0.35,
};

// Pausa media conservadora (~1 pausa/15 palabras ≈ 0.25 s)
const AVG_PAUSE_PER_WORD = 0.25 / 15;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const normalizeLocale = (lang?: string): Locale => {
  const l = (lang || "").toLowerCase();
  if (l.startsWith("es")) return "es";
  if (l.startsWith("en")) return "en";
  if (l.startsWith("fr")) return "fr";
  return "es";
};

const cleanText = (s: string) =>
  s.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();

const countWords = (text: string) => {
  const cleaned = cleanText(text);
  if (!cleaned) return 0;
  return cleaned.split(" ").length;
};

const countPauses = (text: string) => {
  const commas = (text.match(/,/g) || []).length;
  const periods = (text.match(/[.!?]/g) || []).length;
  const colons = (text.match(/[:;]/g) || []).length;
  const newlines = (text.match(/\n/g) || []).length;
  return (
    commas * PAUSE_SECONDS.comma +
    periods * PAUSE_SECONDS.period +
    colons * PAUSE_SECONDS.colonSemicolon +
    newlines * PAUSE_SECONDS.newline
  );
};

function estimateSpeechSeconds(text: string, locale: Locale, speed: number) {
  const words = countWords(text);
  const pauses = countPauses(text);
  const wpm = Math.max(1, BASE_WPM[locale] * Math.max(0.1, speed));
  const speech = (words / wpm) * 60; // segundos puro habla
  return { seconds: speech + pauses, words, wpm, pauses };
}

function maxWordsFor(maxSec: number, locale: Locale, speed: number) {
  const wpm = Math.max(1, BASE_WPM[locale] * Math.max(0.1, speed));
  const secPerWord = 60 / wpm + AVG_PAUSE_PER_WORD;
  return Math.max(0, Math.floor(maxSec / secPerWord));
}

// Interpreta "0-15", "15-30", "45-60" o "60" → segundos objetivo (cap a 60)
function targetSecondsFrom(durationStr: string): number {
  const s = (durationStr || "").trim();
  if (!s) return MAX_SEC;
  if (s.includes("-")) {
    const parts = s.split("-").map((x) => parseInt(x, 10)).filter((n) => !isNaN(n));
    if (parts.length >= 2) return Math.min(MAX_SEC, Math.max(1, parts[1]));
  }
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? Math.min(MAX_SEC, Math.max(1, n)) : MAX_SEC;
}

/** Recorta el guion por líneas y palabras hasta encajar en el presupuesto. */
function trimScriptToBudget(script: string, budgetWords: number): string {
  const lines = script
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: string[] = [];
  let acc = 0;

  for (const line of lines) {
    const w = countWords(line);
    if (acc + w <= budgetWords) {
      out.push(line);
      acc += w;
    } else {
      // Meter parte de la línea si cabe algo
      const remaining = Math.max(0, budgetWords - acc);
      if (remaining > 0) {
        const words = cleanText(line).split(" ");
        out.push(words.slice(0, remaining).join(" ") + "…");
        acc = budgetWords;
      }
      break;
    }
  }

  if (out.length === 0) {
    const words = cleanText(script).split(" ");
    return words.slice(0, budgetWords).join(" ") + (words.length > budgetWords ? "…" : "");
  }

  return out.join("\n");
}

/** Aprieta por iteraciones si la estimación aún se pasa (quita última línea). */
function tightenTo60s(script: string, locale: Locale, speed: number): string {
  let current = script.trim();
  for (let i = 0; i < 100; i++) {
    const est = estimateSpeechSeconds(current, locale, speed).seconds;
    if (est <= MAX_SEC) return current;

    const lines = current.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) {
      const words = cleanText(current).split(" ");
      if (words.length <= 1) return current;
      current = words.slice(0, Math.max(1, Math.floor(words.length * 0.9))).join(" ") + "…";
    } else {
      lines.pop();
      current = lines.join("\n");
    }
  }
  return current;
}

export async function POST(req: NextRequest) {
  const simulate = process.env.SIMULATE === "true";

  try {
    // 1) Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    const uid = decoded?.uid;
    if (!uid) return NextResponse.json({ error: "No uid" }, { status: 401 });

    // 2) Input validation
    const body = (await req.json()) as Body;
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
      return NextResponse.json({ error: "Faltan parámetros obligatorios" }, { status: 400 });
    }

    // Velocidad opcional para alinear con TTS
    const rawSpeed = typeof body.speed === "number" ? body.speed : 1;
    const speed = clamp(rawSpeed, MIN_SPEED, MAX_SPEED);

    // Config de presupuesto
    const locale = normalizeLocale(language);
    const targetSec = targetSecondsFrom(duration);
    const baseBudget = maxWordsFor(targetSec, locale, speed);
    const hardBudget = Math.max(1, Math.floor(baseBudget * 0.97));

    // 🔔 Event: start
    await gaServerEvent(
      "script_regenerate_started",
      {
        simulate,
        description_len: description.length,
        tone,
        platform,
        duration,
        language: locale,
        speed,
        hardBudget,
        targetSec,
      },
      { userId: uid }
    );

    let regeneratedScript = "";

    // 🔁 SIMULACIÓN
    if (simulate) {
      regeneratedScript =
        `Guion simulado (regenerado) — ${Math.min(targetSec, MAX_SEC)}s máx, ~${hardBudget} palabras\n` +
        `Hook fuerte.\n` +
        `Cuerpo con 2-3 líneas.\n` +
        (addCTA ? `CTA final: ${ctaText || "¡Sigue para más!"}\n` : `Cierre contundente.\n`);
    } else {
      // 🔁 REAL — Prompt acotado
      const prompt = `
Eres un copywriter profesional de vídeos cortos (Reels, TikTok, Shorts).
Regenera un guion ORIGINAL y CREATIVO con estos parámetros:

- Tema: ${description}
- Tono: ${tone}
- Plataforma: ${platform}
- Idioma: ${language} (interno: ${locale})
- Estructura: ${structure}
- Máximo absoluto al locutar: ${Math.min(targetSec, MAX_SEC)} segundos
- Presupuesto aproximado de palabras: ${hardBudget} (no lo superes)
${addCTA ? `- Incluir CTA final: "${ctaText || "¡Sigue para más!"}"` : ""}

Reglas estrictas:
1) No digas que eres una IA.
2) Estilo humano, natural y conversacional.
3) Frases cortas y claras, separadas en líneas (una idea por línea).
4) Usa puntuación con moderación; evita muchas comas seguidas.
5) Gancho potente en la primera línea (≤ 12 palabras).
6) En total, **NO superes ${hardBudget} palabras**.

Devuelve solo el guion: sin títulos, comillas ni explicaciones.
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
    }

    if (!regeneratedScript) {
      throw new Error("No se pudo regenerar el guion");
    }

    // 3) Post-procesado: recortar hasta encajar en ≤ 60s
    if (countWords(regeneratedScript) > hardBudget) {
      regeneratedScript = trimScriptToBudget(regeneratedScript, hardBudget);
    }

    let est = estimateSpeechSeconds(regeneratedScript, locale, speed);
    if (est.seconds > MAX_SEC) {
      regeneratedScript = tightenTo60s(regeneratedScript, locale, speed);
      est = estimateSpeechSeconds(regeneratedScript, locale, speed);
    }

    if (est.seconds > MAX_SEC) {
      const tighterBudget = Math.max(1, Math.floor(hardBudget * 0.9));
      regeneratedScript = trimScriptToBudget(regeneratedScript, tighterBudget);
      est = estimateSpeechSeconds(regeneratedScript, locale, speed);
    }

    if (est.seconds > MAX_SEC) {
      const finalBudget = maxWordsFor(MAX_SEC, locale, speed);
      regeneratedScript = trimScriptToBudget(regeneratedScript, finalBudget);
      est = estimateSpeechSeconds(regeneratedScript, locale, speed);
    }

    // 4) Event: completed
    await gaServerEvent(
      "script_regenerate_completed",
      {
        simulated: simulate,
        est_seconds: Math.round(est.seconds),
        locale,
        speed,
        words: countWords(regeneratedScript),
      },
      { userId: uid }
    );

    return NextResponse.json({ script: regeneratedScript, simulated: simulate });
  } catch (error) {
    console.error("❌ Error /scripts/regenerate:", error);
    const msg = error instanceof Error ? error.message : "Error interno regenerando guion";

    // Event: error
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/, "");
    let uid: string | undefined;
    if (idToken) {
      const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
      uid = decoded?.uid;
    }
    await gaServerEvent("script_regenerate_failed", { error: msg }, uid ? { userId: uid } : undefined);

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
