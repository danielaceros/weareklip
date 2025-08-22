// src/app/api/scripts/regenerate/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const FREE_LIMIT = 2;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const uid = String((body as Record<string, unknown>).uid ?? "");
    const scriptId = String((body as Record<string, unknown>).scriptId ?? "");
    const paid =
      String(req.headers.get("x-paid") || "").trim() === "1" ||
      (body as Record<string, unknown>).paid === true;

    if (!uid || !scriptId) {
      return NextResponse.json(
        { error: "Faltan parámetros (uid, scriptId)" },
        { status: 400 }
      );
    }

    const scriptRef = doc(db, "users", uid, "guiones", scriptId);
    const snap = await getDoc(scriptRef);
    if (!snap.exists()) {
      return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });
    }

    const data = snap.data() as Record<string, unknown>;
    const regenCount = Number(data.regenerations ?? 0);

    if (regenCount >= FREE_LIMIT && !paid) {
      // 402: Payment Required
      return NextResponse.json(
        { error: "Has gastado los 2 intentos gratis. Debes pasar por caja para regenerar de nuevo." },
        { status: 402 }
      );
    }

    const prompt = `
Eres un copywriter profesional especializado en guiones para vídeos cortos en redes sociales.
Debes crear un guion ORIGINAL y CREATIVO siguiendo estos parámetros:

- Tema: ${data.description}
- Tono: ${data.tone}
- Plataforma: ${data.platform}
- Duración estimada: ${data.duration} segundos
- Idioma: ${data.language}
- Estructura: ${data.structure}
${data.addCTA ? `- Incluir llamada a la acción: "${data.ctaText || "Invita a seguir la cuenta o interactuar"}"` : ""}

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

    let regeneratedScript = completion.choices[0]?.message?.content || "";
    regeneratedScript = regeneratedScript
      .replace(/^["'\s]+|["'\s]+$/g, "")
      .replace(/^(Aquí.*?:\s*)/i, "")
      .trim();

    const newCount = regenCount + 1;
    await updateDoc(scriptRef, {
      script: regeneratedScript,
      regenerations: newCount,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      scriptId,
      regenerations: newCount,
      script: regeneratedScript,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error interno regenerando guion" },
      { status: 500 }
    );
  }
}
