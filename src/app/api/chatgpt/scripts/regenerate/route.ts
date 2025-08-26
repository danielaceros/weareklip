// src/app/api/scripts/regenerate/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { adminAuth } from "@/lib/firebase-admin";

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

  try {
    // 1) Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    await adminAuth.verifyIdToken(idToken); // solo validar

    // 2) Body
    const body = (await req.json()) as Body;
    const { description, tone, platform, duration, language, structure, addCTA, ctaText } = body;

    if (!description || !tone || !platform || !duration || !language || !structure) {
      return NextResponse.json({ error: "Faltan parámetros obligatorios" }, { status: 400 });
    }

    let regeneratedScript = "";

    // 🔁 RAMA A: SIMULACIÓN
    if (simulate) {
      regeneratedScript = `Este es un guion simulado (regenerado) para el tema "${description}" con tono ${tone}, plataforma ${platform}, duración ${duration}s, idioma ${language}, estructura ${structure}${addCTA ? ` y llamada a la acción "${ctaText || "Invita a seguir"}"` : ""}.`;
    }

    // 🔁 RAMA B: REAL
    else {
      // 3) Prompt
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

      // 4) Generar con OpenAI
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

    // 5) Respuesta simple
    return NextResponse.json({ script: regeneratedScript, simulated: simulate });
  } catch (error) {
    console.error("❌ Error /scripts/regenerate:", error);
    return NextResponse.json(
      { error: "Error interno regenerando guion" },
      { status: 500 }
    );
  }
}
