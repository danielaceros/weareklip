// src/app/api/elevenlabs/audio/regenerate/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDB, adminBucket } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  parentAudioId: string; // 🔑 id del doc padre
  text: string;
  voiceId: string;
  voice_settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    speed?: number;
    use_speaker_boost?: boolean;
  };
};

function cleanVoiceSettings(vs?: Body["voice_settings"]) {
  if (!vs) return {};
  return Object.fromEntries(
    Object.entries(vs).filter(([, v]) => v !== undefined && v !== null)
  );
}

export async function POST(req: Request) {
  const simulate = process.env.SIMULATE === "true";

  try {
    // 1) Auth
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const idToken = authHeader.slice("Bearer ".length);
    const { uid } = await adminAuth.verifyIdToken(idToken);

    // 2) Body
    const { parentAudioId, text, voiceId, voice_settings } =
      (await req.json()) as Body;

    if (!parentAudioId || !text || !voiceId) {
      return NextResponse.json(
        { error: "parentAudioId, text y voiceId son obligatorios" },
        { status: 400 }
      );
    }

    const safeVoiceSettings = cleanVoiceSettings(voice_settings);

    // 🔁 SIMULACIÓN
    if (simulate) {
      console.log("🟢 Simulación activa en /elevenlabs/audio/regenerate");
      const regenId = uuidv4();
      const fakeUrl = `https://fake.elevenlabs.local/${uid}/audios/${parentAudioId}/regen-${regenId}.mp3`;

      await adminDB
        .collection("users")
        .doc(uid)
        .collection("audios")
        .doc(parentAudioId)
        .collection("regenerations")
        .doc(regenId)
        .set({
          regenId,
          text,
          voiceId,
          voice_settings: safeVoiceSettings,
          audioUrl: fakeUrl,
          createdAt: new Date(),
          regenerated: true,
          simulated: true,
        });

      return NextResponse.json({
        ok: true,
        regenId,
        audioUrl: fakeUrl,
        simulated: true,
      });
    }

    // 🔁 REAL
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
          voice_settings: safeVoiceSettings,
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

    // 4) Subir en Storage dentro del padre
    const token = uuidv4();
    const regenId = uuidv4();
    const path = `users/${uid}/audios/${parentAudioId}/regen-${regenId}.mp3`;

    const file = adminBucket.file(path);
    await file.save(buf, {
      contentType: "audio/mpeg",
      resumable: false,
      metadata: { firebaseStorageDownloadTokens: token },
    });

    const audioUrl = `https://firebasestorage.googleapis.com/v0/b/${
      adminBucket.name
    }/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

    // 5) Guardar en Firestore (subcolección regenerations del padre)
    await adminDB
      .collection("users")
      .doc(uid)
      .collection("audios")
      .doc(parentAudioId)
      .collection("regenerations")
      .doc(regenId)
      .set({
        regenId,
        text,
        voiceId,
        voice_settings: safeVoiceSettings,
        audioUrl,
        createdAt: new Date(),
        regenerated: true,
      });

    return NextResponse.json({
      ok: true,
      regenId,
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
