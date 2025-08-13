// src/app/api/scripts/create/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { description, tone, platform, duration, language, structure, addCTA, ctaText } = await req.json();

    if (!description || !tone || !platform || !duration || !language || !structure) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 500,
    });

    let script = completion.choices[0]?.message?.content || "";

    // Limpieza adicional para evitar basura extra
    script = script
      .replace(/^["'\s]+|["'\s]+$/g, "") // quita comillas y espacios al inicio/fin
      .replace(/^(Aquí.*?:\s*)/i, "") // quita frases tipo "Aquí tienes..."
      .trim();

    return NextResponse.json({ script });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error interno generando guion" }, { status: 500 });
  }
}
