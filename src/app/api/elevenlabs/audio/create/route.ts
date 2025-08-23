// src/app/api/elevenlabs/audio/create/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  voiceId: string;
  text: string;
  modelId?: string;
  format?: string;
};

export async function POST(req: Request) {
  const idem = req.headers.get("x-idempotency-key") || randomUUID();

  try {
    // 1) Auth
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    await adminAuth.verifyIdToken(idToken);

    // 2) Body
    const { voiceId, text, modelId, format } = (await req.json()) as Body;
    if (!voiceId || !text) {
      return NextResponse.json({ error: "voiceId y text requeridos" }, { status: 400 });
    }

    const XI_KEY = process.env.ELEVENLABS_API_KEY?.trim();
    if (!XI_KEY) {
      return NextResponse.json({ error: "ELEVENLABS_API_KEY no configurada" }, { status: 500 });
    }

    // 3) ElevenLabs TTS
    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${format || "mp3_44100_128"}`;
    const res = await fetch(ttsUrl, {
      method: "POST",
      headers: {
        "xi-api-key": XI_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: modelId || "eleven_multilingual_v2",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("❌ ElevenLabs TTS error:", err);
      return NextResponse.json({ error: "Error en ElevenLabs", details: err }, { status: 502 });
    }

    const audioBuffer = await res.arrayBuffer();

    // 4) Cobrar consumo → /api/billing/usage
    const usageUrl = new URL("/api/billing/usage", req.url).toString();
    const usageRes = await fetch(usageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        "X-Idempotency-Key": idem,
      },
      body: JSON.stringify({ kind: "voice", quantity: 1, idem }),
    });

    let usage: any = {};
    try {
      usage = await usageRes.json();
    } catch {}
    if (!usageRes.ok || usage.ok !== true) {
      console.error("❌ Error registrando uso voice:", usage);
    }

    // 5) Respuesta
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Usage": JSON.stringify(usage),
      },
    });
  } catch (e) {
    console.error("Error en /api/elevenlabs/audio/create:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
