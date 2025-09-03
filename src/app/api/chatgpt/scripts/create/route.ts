import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { adminAuth, adminDB, adminTimestamp } from "@/lib/firebase-admin";
import { sendEventPush } from "@/lib/sendEventPush";

// ✅ límites y utilidades centralizadas
import {
  MAX_AUDIO_SECONDS as MAX_SEC,
  WPS,
  estimateTtsSeconds,
} from "@/lib/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type UsageResp = {
  ok?: boolean;
  message?: string;
  error?: string;
};

// --- Helpers ---
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
  return words.slice(0, maxWords).join(" ").replace(/\s+([,.!?;:])/g, "$1").trim();
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

// --- Handler ---
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

    // 2) Idempotencia
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
    const duration = sanitize(body.duration, 10); // ej. "45-60"
    const language = sanitize(body.language, 50) || "es";
    const structure = sanitize(body.structure, 100);
    const addCTA = Boolean(body.addCTA);
    const ctaText = sanitize(body.ctaText, 100);

    if (!description || !tone || !platform || !duration || !language || !structure) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    // 3.1) Calcular segundos objetivo (tope 60) y presupuesto de palabras
    const range = parseDurationRange(duration) ?? [0, MAX_SEC];
    const secondsCap = Math.min(range[1], MAX_SEC); // usamos el extremo superior del rango, capped a 60
    const wps = WPS[language] ?? 2.5;
    const wordBudget = Math.max(1, Math.floor(wps * secondsCap));

    // 4) Billing check
    const check = await billingCheck(req, idToken, idem);
    if (!check.ok) {
      await logRef.set({ status: "denied", reason: check.error }, { merge: true });
      return NextResponse.json({ error: check.error }, { status: 402 });
    }

    let script = "";

    // 🔁 RAMA A: Simulación
    if (simulate) {
      script = `Guion simulado (${secondsCap}s, ~${wordBudget} palabras): Tema "${description}", tono ${tone}, plataforma ${platform}, idioma ${language}, estructura ${structure}${addCTA ? `, CTA "${ctaText || "Invita a seguir"}"` : ""}.`;
    } else {
      // 🔁 RAMA B: Real
      const prompt = `
Eres un copywriter profesional de vídeos cortos. Genera un GUION ORIGINAL en ${language} para la plataforma ${platform}.
Parámetros:
- Tema: ${description}
- Tono: ${tone}
- Estructura: ${structure}
- CTA: ${addCTA ? `"${ctaText || "Invita a seguir"}"` : "No incluir si no aporta"}

CONSTRAINTS (OBLIGATORIAS):
- Duración objetivo ≈ ${secondsCap} segundos. Máximo absoluto ${MAX_SEC} s.
- Presupuesto de palabras: NO SUPERE ${wordBudget} palabras.
- Frases cortas, naturales, en líneas pensadas para locución.
- Gancho fuerte en las primeras 1–2 líneas.
- No menciones que eres IA. No incluyas títulos, notas ni comillas. Devuelve SOLO el guion.
`.trim();

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

      // 4.1) Post-procesado defensivo: recortar a presupuesto si se excede
      if (script) {
        script = truncateToWords(script, wordBudget).trim();

        // 4.2) Validación de duración estimada (velocidad 1x)
        const estSec = estimateTtsSeconds(script, language, 1);
        if (estSec > MAX_SEC) {
          // Reintento de recorte conservador
          const hardBudget = Math.max(1, Math.floor(wps * MAX_SEC));
          script = truncateToWords(script, hardBudget).trim();
        }
      }
    }

    // 5) Confirmar facturación (solo si hay script válido)
    if (script) {
      await billingConfirm(req, idToken, idem);
    } else {
      throw new Error("OpenAI no devolvió guion");
    }

    // 6) Guardar log y notificar
    await logRef.set(
      {
        status: "success",
        simulated: simulate,
        script,
        secondsCap,
        wordBudget,
        completedAt: adminTimestamp.now(),
      },
      { merge: true }
    );

    if (uid) {
      await sendEventPush(uid, "script_generated", { length: String(script.length) });
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
