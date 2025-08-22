// src/app/api/elevenlabs/audio/regenerate/route.ts
import { NextResponse } from "next/server";
import {
  adminAuth,
  adminDB,
  adminStorage,
  adminTimestamp,
} from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  audioId: string;
  text: string;
  voiceId?: string;
  // llegan en snake_case desde el cliente:
  language_code?: string;
  voice_settings?: Record<string, unknown>;
};

const FREE_REGENS = 2;
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

    const audioId = (data.audioId || "").trim();
    const text = (data.text || "").trim();
    const bodyVoiceId = (data.voiceId || "").trim();

    // ✅ usamos camelCase internamente y mapeamos a snake_case al enviar
    const languageCode =
      typeof data.language_code === "string" && data.language_code.trim()
        ? data.language_code.trim()
        : "es";

    const voiceSettings: Record<string, unknown> =
      data &&
      typeof data === "object" &&
      data.voice_settings &&
      typeof data.voice_settings === "object"
        ? (data.voice_settings as Record<string, unknown>)
        : {};

    if (!audioId || !text) {
      return NextResponse.json(
        { error: "audioId y text son obligatorios" },
        { status: 400 }
      );
    }

    // 3) Limite de regeneraciones
    const docRef = adminDB.collection("users").doc(uid).collection("audios").doc(audioId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Audio no encontrado" }, { status: 404 });
    }
    const current = snap.data() || {};
    const used = Number(current.regenerations ?? 0);
    if (used >= FREE_REGENS) {
      return NextResponse.json(
        {
          error:
            "Has alcanzado los 2 reintentos gratis. Vuelve a recargar saldo para intentarlo de nuevo.",
        },
        { status: 402 }
      );
    }

    const voiceId = bodyVoiceId || String(current.voiceId || "");
    if (!voiceId) {
      return NextResponse.json({ error: "voiceId inválido" }, { status: 400 });
    }

    // 4) ElevenLabs TTS
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
          // 👇 la API espera snake_case; mapeamos desde camelCase
          language_code: languageCode,
          voice_settings: voiceSettings,
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

    // 5) Guardar en Storage (nuevo archivo)
    const token = uuidv4();
    const path = `users/${uid}/audios/${audioId}-r${used + 1}.mp3`;
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

    // 6) Actualizar Firestore (sumar regeneración)
    await docRef.update({
      audioUrl,
      text,
      voiceId,
      regenerations: used + 1,
      updatedAt: adminTimestamp.now(),
    });

    return NextResponse.json({
      audioId,
      audioUrl,
      regenerations: used + 1,
      freeLimit: FREE_REGENS,
    });
  } catch (e) {
    console.error("Error /api/elevenlabs/audio/regenerate:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
