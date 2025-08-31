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

// --- Helpers ---
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
    const duration = sanitize(body.duration, 10);
    const language = sanitize(body.language, 50);
    const structure = sanitize(body.structure, 100);
    const addCTA = Boolean(body.addCTA);
    const ctaText = sanitize(body.ctaText, 100);

    if (!description || !tone || !platform || !duration || !language || !structure) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    // 4) Billing check (antes de gastar tokens reales)
    const check = await billingCheck(req, idToken, idem);
    if (!check.ok) {
      await logRef.set({ status: "denied", reason: check.error }, { merge: true });
      return NextResponse.json({ error: check.error }, { status: 402 });
    }

    let script = "";

    // 🔁 RAMA A: Simulación
    if (simulate) {
      script = `Este es un guion simulado para el tema "${description}" con tono ${tone}, plataforma ${platform}, duración ${duration}s, idioma ${language}, estructura ${structure}${addCTA ? ` y CTA "${ctaText || "Invita a seguir"}` : ""}.`;
    } else {
      // 🔁 RAMA B: Real
      const prompt = `
Eres un copywriter profesional especializado en guiones para vídeos cortos en redes sociales.
Debes crear un guion ORIGINAL y CREATIVO siguiendo estos parámetros:

- Tema: ${description}
- Tono: ${tone}
- Plataforma: ${platform}
- Duración estimada: ${duration} segundos
- Idioma: ${language}
- Estructura: ${structure}
${addCTA ? `- Incluir llamada a la acción: "${ctaText || "Invita a seguir"}"` : ""}

Reglas estrictas:
1. No mencionar que eres una IA.
2. Mantener un estilo humano y natural.
3. Usar frases cortas y claras.
4. Separar el guion en frases o líneas pensadas para ser leídas en voz alta.
5. Optimizar para captar la atención en los primeros 3 segundos.
6. Devuelve únicamente el guion, sin explicaciones, títulos ni comillas.
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
