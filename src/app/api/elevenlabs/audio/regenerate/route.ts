// src/app/api/elevenlabs/audio/regenerate/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminStorage } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  text: string;
  voiceId: string;
  language_code?: string;
  voice_settings?: Record<string, unknown>;
};

const bucket = adminStorage.bucket(
  process.env.FIREBASE_STORAGE_BUCKET || undefined
);

export async function POST(req: Request) {
  try {
    // 1) Auth
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const idToken = authHeader.slice("Bearer ".length);
    const { uid } = await adminAuth.verifyIdToken(idToken);

    // 2) Body
    const data = (await req.json()) as Body;
    const { text, voiceId, language_code, voice_settings } = data;
    if (!text || !voiceId) {
      return NextResponse.json(
        { error: "text y voiceId son obligatorios" },
        { status: 400 }
      );
    }

    // 3) ElevenLabs TTS
    const xiKey = (process.env.ELEVENLABS_API_KEY || "").trim();
    if (!xiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": xiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          language_code,
          voice_settings,
        }),
      }
    );

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("ElevenLabs regenerate error:", errText);
      return NextResponse.json(
        { error: "Error regenerando audio" },
        { status: 500 }
      );
    }

    const buf = Buffer.from(await r.arrayBuffer());

    // 4) Guardar en Storage (sobrescribir simple)
    const token = uuidv4();
    const path = `users/${uid}/audios/${Date.now()}-regen.mp3`;
    const file = bucket.file(path);
    await file.save(buf, {
      contentType: "audio/mpeg",
      metadata: { firebaseStorageDownloadTokens: token },
    });

    // URL pública
    const rawBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
    const bucketName = rawBucket.replace(
      /\.firebasestorage\.app$/i,
      ".appspot.com"
    );
    const audioUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
      path
    )}?alt=media&token=${token}`;

    return NextResponse.json({ audioUrl });
  } catch (e) {
    console.error("Error /api/elevenlabs/audio/regenerate:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
