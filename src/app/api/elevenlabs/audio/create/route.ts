import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { adminAuth, adminDB, adminBucket } from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server";
import { sendEventPush } from "@/lib/sendEventPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ================== LÍMITES Y ESTIMACIÓN ================== */
const MAX_SEC = 60;
const MIN_SPEED = 0.7;
const MAX_SPEED = 1.2;

type Locale = "es" | "en" | "fr";

const BASE_WPM: Record<Locale, number> = {
  es: 160,
  en: 170,
  fr: 150,
};

const PAUSE_SECONDS = {
  comma: 0.25,
  period: 0.6,
  newline: 0.6,
  colonSemicolon: 0.35,
};

// Pausa media conservadora (~1 pausa/15 palabras ≈ 0.25 s)
const AVG_PAUSE_PER_WORD = 0.25 / 15;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const normalizeLocale = (lang?: string): Locale =>
  (["es", "en", "fr"].includes(String(lang)) ? (lang as Locale) : "es");

const cleanText = (s: string) =>
  s.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();

const countWords = (text: string) => {
  const cleaned = cleanText(text);
  if (!cleaned) return 0;
  return cleaned.split(" ").length;
};

const countPauses = (text: string) => {
  const commas = (text.match(/,/g) || []).length;
  const periods = (text.match(/[.!?]/g) || []).length;
  const colons = (text.match(/[:;]/g) || []).length;
  const newlines = (text.match(/\n/g) || []).length;
  return (
    commas * PAUSE_SECONDS.comma +
    periods * PAUSE_SECONDS.period +
    colons * PAUSE_SECONDS.colonSemicolon +
    newlines * PAUSE_SECONDS.newline
  );
};

function estimateSpeechSeconds(text: string, locale: Locale, speed: number) {
  const words = countWords(text);
  const pauses = countPauses(text);
  const wpm = Math.max(1, BASE_WPM[locale] * Math.max(0.1, speed));
  const speech = (words / wpm) * 60; // segundos puro habla
  return {
    seconds: speech + pauses,
    words,
    wpm,
    pauses,
  };
}

function maxWordsFor(maxSec: number, locale: Locale, speed: number) {
  const wpm = Math.max(1, BASE_WPM[locale] * Math.max(0.1, speed));
  const secPerWord = 60 / wpm + AVG_PAUSE_PER_WORD;
  return Math.max(0, Math.floor(maxSec / secPerWord));
}

/** ================== BODY ================== */
type Body = {
  voiceId: string;
  text: string;
  modelId?: string;
  format?: string;
  // ⬇️ Título opcional
  name?: string;
  title?: string;
  // ⬇️ Idioma (opcional). Si no viene, asumimos "es" (igual que la UI actual).
  language?: string;
  languageCode?: string;
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

    // 2) Body validation and sanitization
    const {
      voiceId,
      text,
      modelId,
      format,
      voice_settings,
      name,
      title,
      language,
      languageCode,
    } = (await req.json()) as Body;

    if (!voiceId || !text) {
      return NextResponse.json(
        { error: "voiceId y text son requeridos" },
        { status: 400 }
      );
    }

    const safeVoiceSettings = cleanVoiceSettings(voice_settings);
    // Normalizamos velocidad en rango permitido
    const rawSpeed =
      typeof safeVoiceSettings.speed === "number" ? safeVoiceSettings.speed : 1;
    const safeSpeed = clamp(rawSpeed, MIN_SPEED, MAX_SPEED);
    if (safeSpeed !== rawSpeed) {
      (safeVoiceSettings as any).speed = safeSpeed;
    }

    // Normalizamos idioma (por ahora UI solo manda 'es', pero dejamos preparado)
    const locale = normalizeLocale(language ?? languageCode ?? "es");

    // Normalizamos nombre (máx 80 chars)
    const rawTitle = (title ?? name ?? "").trim();
    const safeTitle = rawTitle ? rawTitle.slice(0, 80) : "";

    // 2.1) Guard de duración (server-side)
    const { seconds: estSeconds, words, wpm, pauses } = estimateSpeechSeconds(
      text,
      locale,
      safeSpeed
    );

    if (estSeconds > MAX_SEC) {
      const budgetWords = maxWordsFor(MAX_SEC, locale, safeSpeed);

      // Evento bloqueado por límite
      await gaServerEvent(
        "voice_generation_blocked",
        {
          reason: "over_60s",
          est_seconds: Math.round(estSeconds),
          max_seconds: MAX_SEC,
          words,
          budget_words: budgetWords,
          wpm,
          pauses: Math.round(pauses * 100) / 100,
          voiceId,
        },
        { userId: uid }
      );

      return NextResponse.json(
        {
          error: "TEXT_TOO_LONG_FOR_60S",
          message:
            "El texto estimado supera el máximo permitido de 60 segundos.",
          details: {
            estSeconds: Math.round(estSeconds),
            maxSeconds: MAX_SEC,
            words,
            budgetWords,
            locale,
            speed: safeSpeed,
          },
        },
        { status: 400 }
      );
    }

    // 🔔 Evento: inicio de generación de audio
    await gaServerEvent(
      "voice_generation_started",
      {
        simulate,
        voiceId,
        text_length: text.length,
        est_seconds: Math.round(estSeconds),
        locale,
        speed: safeSpeed,
      },
      { userId: uid }
    );

    // 🔁 Simulación
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
          name: safeTitle,
          title: safeTitle,
          language: locale,
          durationHint: estSeconds,
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

      await gaServerEvent(
        "voice_generation_completed",
        {
          simulate: true,
          audioId,
          voiceId,
          text_length: text.length,
          est_seconds: Math.round(estSeconds),
        },
        { userId: uid }
      );

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

    // 🔁 Real (no simulado)
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
        voice_settings: safeVoiceSettings, // speed ya viene clamped
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

    // 5) Guardar en Firestore (incluyendo nombre/título, idioma y estimación)
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
        name: safeTitle,
        title: safeTitle,
        language: locale,
        durationHint: estSeconds,
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

    await gaServerEvent(
      "voice_generation_completed",
      {
        simulate: false,
        audioId,
        voiceId,
        text_length: text.length,
        est_seconds: Math.round(estSeconds),
      },
      { userId: uid }
    );

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
