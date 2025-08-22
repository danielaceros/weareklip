import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type UsageResp = {
  ok?: boolean;
  message?: string;
  error?: string;
  chargedCents?: number;
  creditedCents?: number;
  currency?: string;
};

export async function POST(req: NextRequest) {
  // Usamos una misma key para toda la operación (idempotente)
  const idem = req.headers.get("x-idempotency-key") || randomUUID();

  try {
    // 1) Auth: vamos a reenviar el mismo token a /api/billing/usage
    const authHeader = req.headers.get("authorization") || "";
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) return NextResponse.json({ error: "No auth" }, { status: 401 });
    const idToken = m[1];

    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    const uid = decoded?.uid;
    if (!uid) return NextResponse.json({ error: "No uid" }, { status: 401 });

    // 2) Body (igual que antes)
    const {
      description,
      tone,
      platform,
      duration,
      language,
      structure,
      addCTA,
      ctaText,
    } = await req.json();

    if (!description || !tone || !platform || !duration || !language || !structure) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // 3) Prompt (igual que tenías)
    const prompt = `
Eres un copywriter profesional especializado en guiones para vídeos cortos en redes sociales.
Debes crear un guion ORIGINAL y CREATIVO siguiendo estos parámetros:

- Tema: ${description}
- Tono: ${tone}
- Plataforma: ${platform}
- Duración estimada: ${duration} segundos
- Idioma: ${language}
- Estructura: ${structure}
${addCTA ? `- Incluir llamada a la acción: "${ctaText || "Invita a seguir la cuenta o interactuar"}"` : ""}

Reglas estrictas:
1. No mencionar que eres una IA.
2. Mantener un estilo humano y natural.
3. Usar frases cortas y claras.
4. Separar el guion en frases o líneas pensadas para ser leídas en voz alta.
5. Optimizar para captar la atención en los primeros 3 segundos.
6. **Devuelve ÚNICAMENTE el guion, sin explicaciones, sin títulos, sin comillas, sin texto extra.**
7. No incluyas frases como "Aquí tienes tu guion" o similares.

Tu salida debe ser SOLO el texto final del guion listo para usarse.
`.trim();

    // 4) Generación con OpenAI (como antes)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 500,
    });

    let script = completion.choices[0]?.message?.content || "";
    script = script
      .replace(/^["'\s]+|["'\s]+$/g, "") // quita comillas/espacios inicio-fin
      .replace(/^(Aquí.*?:\s*)/i, "")    // quita "Aquí tienes..." etc
      .trim();

    // 5) Registrar uso en TU backend (meters, crédito, tope…)
    const usageUrl = new URL("/api/billing/usage", req.nextUrl.origin).toString();
    const usageRes = await fetch(usageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,  // reenviamos el mismo Bearer
        "X-Idempotency-Key": idem,  // misma clave para reintentos
      },
      body: JSON.stringify({ kind: "script", quantity: 1, idem }),
    });

    let usage: UsageResp = {};
    try {
      usage = (await usageRes.json()) as UsageResp;
    } catch {
      usage = {};
    }

    if (!usageRes.ok || usage.ok !== true) {
      const msg = usage.message || usage.error || `usage status ${usageRes.status}`;
      throw new Error(msg);
    }

    // 6) Respuesta (igual que esperaba tu cliente)
    return NextResponse.json({ script });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno generando guion";
    const isAuth = /No auth|No uid/i.test(msg);
    return NextResponse.json({ error: msg }, { status: isAuth ? 401 : 500 });
  }
}
