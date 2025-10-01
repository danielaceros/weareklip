// src/app/api/scripts/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { adminAuth, adminDB, adminTimestamp } from "@/lib/firebase-admin";
import { sendEventPush } from "@/lib/sendEventPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type UsageResp = {
  ok?: boolean;
  message?: string;
  error?: string;
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
      // Intentar meter parte de la línea si cabe algo
      const remaining = Math.max(0, budgetWords - acc);
      if (remaining > 0) {
        const words = cleanText(line).split(" ");
        out.push(words.slice(0, remaining).join(" ") + "…");
        acc = budgetWords;
      }
      break;
    }
  }

  // Si no había líneas (o estaba vacío), devolvemos las primeras N palabras del texto original
  if (out.length === 0) {
    const words = cleanText(script).split(" ");
    return words.slice(0, budgetWords).join(" ") + (words.length > budgetWords ? "…" : "");
  }

  return out.join("\n");
}

/** Aprieta por iteraciones si la estimación aún se pasa (quita última línea sucesivamente). */
function tightenTo60s(script: string, locale: Locale, speed: number): string {
  let current = script.trim();
  for (let i = 0; i < 100; i++) {
    const est = estimateSpeechSeconds(current, locale, speed).seconds;
    if (est <= MAX_SEC) return current;

    // Quitar la última línea
    const lines = current.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) {
      // última opción: recortar palabras
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

/** ================== BILLING HELPERS ================== */
function sanitize(input: unknown, max = 200): string {
  return typeof input === "string"
    ? input.replace(/[\r\n]+/g, " ").slice(0, max).trim()
    : "";
}

async function billingCheck(
  req: NextRequest,
  idToken: string,
  idem: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(new URL("/api/billing/usage", req.nextUrl.origin), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      "X-Idempotency-Key": idem,
    },
    // preview:true → valida suscripción y crédito, pero no factura todavía
    body: JSON.stringify({ kind: "script", quantity: 1, idem, preview: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error || `usage check ${res.status}` };
  }
  return { ok: true };
}

async function billingConfirm(
  req: NextRequest,
  idToken: string,
  idem: string
): Promise<void> {
  const res = await fetch(new URL("/api/billing/usage", req.nextUrl.origin), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      "X-Idempotency-Key": idem,
    },
    body: JSON.stringify({ kind: "script", quantity: 1, idem }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `usage confirm ${res.status}`);
  }
}

/** ================== HANDLER ================== */
export async function POST(req: NextRequest) {
  const idem = req.headers.get("x-idempotency-key") || randomUUID();
  const simulate = process.env.SIMULATE === "true";
  let uid: string | undefined;

  try {
    // 1) Auth
    const authHeader = req.headers.get("authorization") || "";
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) return NextResponse.json({ error: "No auth" }, { status: 401 });
    const idToken = m[1];
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    uid = decoded?.uid;
    if (!uid) return NextResponse.json({ error: "No uid" }, { status: 401 });

    // 2) Idempotencia (evitar dobles cargos)
    const logRef = adminDB
      .collection("users")
      .doc(uid)
      .collection("usage_logs")
      .doc(idem);
    const existing = await logRef.get();
    if (existing.exists) {
      const data = existing.data();
      if (data?.status === "success") {
        return NextResponse.json({ script: data.script, simulated: data.simulated });
      }
      if (data?.status === "pending") {
        return NextResponse.json({ error: "Request already in progress" }, { status: 409 });
      }
    }
    await logRef.set({
      status: "pending",
      kind: "script",
      createdAt: adminTimestamp.now(),
    });

    // 3) Inputs (validación y sanitización)
    const body = await req.json();
    const description = sanitize(body.description, 300);
    const tone = sanitize(body.tone, 100);
    const platform = sanitize(body.platform, 50);
    const duration = sanitize(body.duration, 10); // "0-15" | "15-30" | "45-60"
    const language = sanitize(body.language, 50);
    const structure = sanitize(body.structure, 100);
    const addCTA = Boolean(body.addCTA);
    const ctaText = sanitize(body.ctaText, 100);

    // velocidad opcional (si la UI decide enviarla). Si no, 1.0
    const rawSpeed = typeof body.speed === "number" ? body.speed : 1;
    const speed = clamp(rawSpeed, MIN_SPEED, MAX_SPEED);

    if (!description || !tone || !platform || !duration || !language || !structure) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    // 3.1) Config estimación
    const locale = normalizeLocale(language);
    const targetSec = targetSecondsFrom(duration); // cap a 60
    // Presupuesto base de palabras (deja ~3% margen)
    const baseBudget = maxWordsFor(targetSec, locale, speed);
    const hardBudget = Math.max(1, Math.floor(baseBudget * 0.97));

    // 4) Billing check (antes de gastar tokens reales)
    const check = await billingCheck(req, idToken, idem);
    if (!check.ok) {
      await logRef.set({ status: "denied", reason: check.error }, { merge: true });
      return NextResponse.json({ error: check.error }, { status: 402 });
    }

    let script = "";

    // 🔁 RAMA A: Simulación
    if (simulate) {
      script =
        `Guion simulado (${Math.min(targetSec, MAX_SEC)}s máx, ~${hardBudget} palabras):\n` +
        `Hook fuerte.\n` +
        `Desarrollo breve con 2-3 frases.\n` +
        (addCTA ? `Cierre con CTA: ${ctaText || "¡Sigue para más!"}\n` : `Cierre contundente.\n`);
    } else {
      // 🔁 RAMA B: Real — Prompt con presupuesto
      const prompt = `
Eres un copywriter profesional de vídeos cortos (Reels, TikTok, Shorts).
Genera un guion ORIGINAL y CREATIVO siguiendo estos parámetros:

- Tema: ${description}
- Tono: ${tone}
- Plataforma: ${platform}
- Idioma: ${language} (código interno: ${locale})
- Estructura: ${structure}
- Máximo absoluto de duración al locutar: ${Math.min(targetSec, MAX_SEC)} segundos
- Presupuesto aproximado de palabras: ${hardBudget} (no lo superes)
${addCTA ? `- Incluir CTA al final: "${ctaText || "¡Sigue para más!"}"` : ""}

Reglas estrictas:
1) No menciones que eres una IA.
2) Estilo humano, natural y conversacional.
3) Frases cortas y claras, separadas en líneas (una idea por línea).
4) Usa signos de puntuación con moderación; evita demasiadas comas seguidas.
5) Gancho potente en la primera línea (<= 12 palabras).
6) En total, **NO superes ${hardBudget} palabras**.

Devuelve únicamente el guion, sin títulos, sin comillas y sin explicaciones.
`.trim();

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
        max_tokens: 500, // suficiente para ~hardBudget palabras
      });

      script =
        completion.choices[0]?.message?.content
          ?.replace(/^["'\s]+|["'\s]+$/g, "")
          .replace(/^(Aquí.*?:\s*)/i, "")
          .trim() || "";
    }

    if (!script) throw new Error("OpenAI no devolvió guion");

    // 5) Post-procesado: recorte/ajuste duro a ≤ 60s
    // 5.1) Si excede el presupuesto de palabras, recortamos
    const words = countWords(script);
    if (words > hardBudget) {
      script = trimScriptToBudget(script, hardBudget);
    }

    // 5.2) Estimación final y apriete iterativo si aún excede 60s
    let est = estimateSpeechSeconds(script, locale, speed);
    if (est.seconds > MAX_SEC) {
      // Intentar apretar quitando líneas desde el final
      script = tightenTo60s(script, locale, speed);
      est = estimateSpeechSeconds(script, locale, speed);
    }

    // Safety net: si aún excede, hacemos un recorte por palabras extra-estricto
    if (est.seconds > MAX_SEC) {
      const tighterBudget = Math.max(1, Math.floor(hardBudget * 0.9));
      script = trimScriptToBudget(script, tighterBudget);
    }

    // Recalcular estimación final
    est = estimateSpeechSeconds(script, locale, speed);
    if (est.seconds > MAX_SEC) {
      // Último intento: cortar al presupuesto máximo teórico
      const finalBudget = maxWordsFor(MAX_SEC, locale, speed);
      script = trimScriptToBudget(script, finalBudget);
    }

    // 6) Confirmar facturación (solo si hay script válido)
    if (script) {
      await billingConfirm(req, idToken, idem);
    } else {
      throw new Error("No se pudo generar un guion válido");
    }

    // 7) Guardar log (opcional: podrías guardar locale/speed/budget/estimación)
    await logRef.set(
      {
        status: "success",
        simulated: simulate,
        script,
        meta: {
          locale,
          speed,
          targetSec,
          hardBudget,
          estSeconds: Math.round(estimateSpeechSeconds(script, locale, speed).seconds),
        },
        completedAt: adminTimestamp.now(),
      },
      { merge: true }
    );

    if (uid) {
      await sendEventPush(uid, "script_generated", {
        length: String(script.length),
      });
    }

    return NextResponse.json({ script, simulated: simulate });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno generando guion";
    const isAuth = /No auth|No uid/i.test(msg);

    if (uid) {
      try {
        await sendEventPush(uid, "script_error", { reason: String(msg) });
      } catch {}
    }

    return NextResponse.json({ error: msg }, { status: isAuth ? 401 : 500 });
  }
}
