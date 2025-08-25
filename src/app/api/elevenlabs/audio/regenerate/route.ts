// src/app/api/elevenlabs/audio/regenerate/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDB, adminBucket } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  text: string;
  voiceId: string;
  voice_settings?: Record<string, unknown>;
};

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
    const { text, voiceId, voice_settings } =
      (await req.json()) as Body;

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
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": xiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings,
        }),
      }
    );

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("❌ ElevenLabs regenerate error:", errText);
      return NextResponse.json(
        { error: "Error regenerando audio", details: errText },
        { status: 502 }
      );
    }

    const buf = Buffer.from(await r.arrayBuffer());

    // 4) Guardar en Storage
    const token = uuidv4();
    const audioId = uuidv4();
    const path = `users/${uid}/audios/${audioId}-regen.mp3`;

    const file = adminBucket.file(path);
    await file.save(buf, {
      contentType: "audio/mpeg",
      resumable: false,
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    });

    const audioUrl = `https://firebasestorage.googleapis.com/v0/b/${
      adminBucket.name
    }/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

    // 5) Guardar en Firestore
    const audioData: Record<string, any> = {
      audioId,
      uid,
      voiceId,
      text,
      audioUrl,
      createdAt: new Date(),
      regenerated: true,
    };

    // Solo guarda voice_settings si existe
    if (voice_settings && Object.keys(voice_settings).length > 0) {
      audioData.voice_settings = voice_settings;
    }

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("audios")
      .doc(audioId)
      .set(audioData);

    // 6) Respuesta
    return NextResponse.json({
      ok: true,
      audioId,
      audioUrl,
    });
  } catch (e: any) {
    console.error("❌ Error /api/elevenlabs/audio/regenerate:", e?.message, e);
    return NextResponse.json(
      { error: "Error interno", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
