// src/app/api/scripts/regenerate/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { adminAuth } from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  description: string;
  tone: string;
  platform: string;
  duration: string;
  language: string;
  structure: string;
  addCTA?: boolean;
  ctaText?: string;
};

export async function POST(req: Request) {
  const simulate = process.env.SIMULATE === "true";
  const idem = randomUUID();

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

    // 2) Body
    const body = (await req.json()) as Body;
    const { description, tone, platform, duration, language, structure, addCTA, ctaText } = body;

    if (!description || !tone || !platform || !duration || !language || !structure) {
      return NextResponse.json({ error: "Faltan parámetros obligatorios" }, { status: 400 });
    }

    let regeneratedScript = "";

    // 🔔 Evento: inicio de regeneración
    await gaServerEvent(
      "script_regenerate_started",
      { simulate, description, tone, platform, duration, language },
      { userId: uid }
    );

    // 🔁 RAMA A: SIMULACIÓN
    if (simulate) {
      regeneratedScript = `Este es un guion simulado (regenerado) para el tema "${description}" con tono ${tone}, plataforma ${platform}, duración ${duration}s, idioma ${language}, estructura ${structure}${addCTA ? ` y llamada a la acción "${ctaText || "Invita a seguir"}"` : ""}.`;
    }

    // 🔁 RAMA B: REAL
    else {
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

    // 🔔 Evento: regeneración completada
    await gaServerEvent(
      "script_regenerate_completed",
      { length: regeneratedScript.length, simulated: simulate },
      { userId: uid }
    );

    return NextResponse.json({ script: regeneratedScript, simulated: simulate });
  } catch (error) {
    console.error("❌ Error /scripts/regenerate:", error);
    const msg = error instanceof Error ? error.message : "Error interno regenerando guion";

    // 🔔 Evento: error en regeneración
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
