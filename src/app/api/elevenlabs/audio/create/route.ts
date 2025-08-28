// src/app/api/elevenlabs/audio/create/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { adminAuth, adminDB, adminBucket } from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server";
import { sendEventPush } from "@/lib/sendEventPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  voiceId: string;
  text: string;
  modelId?: string;
  format?: string;
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
  const idem = req.headers.get("x-idempotency-key") || randomUUID();
  const simulate = process.env.SIMULATE === "true";

  try {
    // 1) Auth
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    const { uid } = await adminAuth.verifyIdToken(idToken);

    // 2) Body
    const { voiceId, text, modelId, format, voice_settings } =
      (await req.json()) as Body;

    if (!voiceId || !text) {
      return NextResponse.json(
        { error: "voiceId y text requeridos" },
        { status: 400 }
      );
    }

    const safeVoiceSettings = cleanVoiceSettings(voice_settings);

    // 🔔 Evento: inicio generación audio
    await gaServerEvent(
      "voice_generation_started",
      { simulate, voiceId, text_length: text.length },
      { userId: uid }
    );

    // 🔁 SIMULACIÓN
    if (simulate) {
      const audioId = randomUUID();
      const fakeUrl = `https://fake.elevenlabs.local/${uid}/audios/${audioId}.mp3`;

      await adminDB
        .collection("users")
        .doc(uid)
        .collection("audios")
        .doc(audioId)
        .set({
          audioId,
          uid,
          voiceId,
          text,
          voice_settings: safeVoiceSettings,
          audioUrl: fakeUrl,
          createdAt: new Date(),
          simulated: true,
        });

      // ⚡ Registrar uso aunque sea simulado
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
        console.error("❌ Error registrando uso voice (simulado):", usage);
      }

      // 🔔 Evento: audio generado (simulado)
      await gaServerEvent(
        "voice_generation_completed",
        { simulate: true, audioId, voiceId, text_length: text.length },
        { userId: uid }
      );

      // ✅ Notificación in-app (preview disponible)
      try {
        await sendEventPush(uid, "voice_preview", {
          audioId,
          voiceId,
          simulated: true,
        });
      } catch {}

      return NextResponse.json({
        ok: true,
        audioId,
        audioUrl: fakeUrl,
        usage,
      });
    }

    // 🔁 REAL
    const XI_KEY = process.env.ELEVENLABS_API_KEY?.trim();
    if (!XI_KEY) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${
      format || "mp3_44100_128"
    }`;

    const res = await fetch(ttsUrl, {
      method: "POST",
      headers: {
        "xi-api-key": XI_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: modelId || "eleven_multilingual_v2",
        voice_settings: safeVoiceSettings,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("❌ ElevenLabs TTS error:", err);

      await gaServerEvent(
        "voice_generation_failed",
        { error: err, voiceId },
        { userId: uid }
      );

      // ❗ Notificación de error
      try {
        await sendEventPush(uid, "voice_error", { voiceId, error: err });
      } catch {}

      return NextResponse.json(
        { error: "Error en ElevenLabs", details: err },
        { status: 502 }
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // 4) Subir a Firebase Storage
    const audioId = randomUUID();
    const filePath = `users/${uid}/audios/${audioId}.mp3`;

    const file = adminBucket.file(filePath);
    await file.save(audioBuffer, {
      contentType: "audio/mpeg",
      resumable: false,
      metadata: {
        firebaseStorageDownloadTokens: audioId,
      },
    });

    const audioUrl = `https://firebasestorage.googleapis.com/v0/b/${
      adminBucket.name
    }/o/${encodeURIComponent(filePath)}?alt=media&token=${audioId}`;

    // 5) Guardar en Firestore
    await adminDB
      .collection("users")
      .doc(uid)
      .collection("audios")
      .doc(audioId)
      .set({
        audioId,
        uid,
        voiceId,
        text,
        voice_settings: safeVoiceSettings,
        audioUrl,
        createdAt: new Date(),
      });

    // 6) Registrar uso
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

    // 🔔 Evento: audio generado (real)
    await gaServerEvent(
      "voice_generation_completed",
      { simulate: false, audioId, voiceId, text_length: text.length },
      { userId: uid }
    );

    // ✅ Notificación in-app (preview disponible)
    try {
      await sendEventPush(uid, "voice_preview", {
        audioId,
        voiceId,
        url: audioUrl,
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      audioId,
      audioUrl,
      usage,
    });
  } catch (e: any) {
    console.error("❌ Error en /api/elevenlabs/audio/create:", e?.message, e);

    // Evento de error
    const authHeader = req.headers.get("Authorization");
    let uid: string | undefined;
    if (authHeader?.startsWith("Bearer ")) {
      const idToken = authHeader.split(" ")[1];
      const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
      uid = decoded?.uid;
    }

    await gaServerEvent(
      "voice_generation_failed",
      { error: e?.message || String(e) },
      uid ? { userId: uid } : undefined
    );

    // ❗ Notificación de error
    if (uid) {
      try {
        await sendEventPush(uid, "voice_error", { error: e?.message || String(e) });
      } catch {}
    }

    return NextResponse.json(
      { error: "Error interno", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
