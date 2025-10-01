import { NextResponse } from "next/server";
import { adminAuth, adminDB, adminBucket } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";
import { gaServerEvent } from "@/lib/ga-server";

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
  const speech = (words / wpm) * 60; // segundos de locución sin pausas
  return { seconds: speech + pauses, words, wpm, pauses };
}

function maxWordsFor(maxSec: number, locale: Locale, speed: number) {
  const wpm = Math.max(1, BASE_WPM[locale] * Math.max(0.1, speed));
  const secPerWord = 60 / wpm + AVG_PAUSE_PER_WORD;
  return Math.max(0, Math.floor(maxSec / secPerWord));
}

/** ================== BODY ================== */
type Body = {
  parentAudioId: string;
  text: string;
  voiceId: string;
  // opcional, puede venir del cliente (aunque la UI actual lo fija a "es")
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
  const simulate = process.env.SIMULATE === "true";

  try {
    // 1) Auth
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const idToken = authHeader.slice("Bearer ".length);
    const { uid } = await adminAuth.verifyIdToken(idToken);

    // 2) Body validation and sanitization
    const { parentAudioId, text, voiceId, voice_settings, language, languageCode } =
      (await req.json()) as Body;

    if (!parentAudioId || !text || !voiceId) {
      return NextResponse.json(
        { error: "parentAudioId, text y voiceId son obligatorios" },
        { status: 400 }
      );
    }

    const safeVoiceSettings = cleanVoiceSettings(voice_settings);
    // clamp de velocidad
    const rawSpeed =
      typeof safeVoiceSettings.speed === "number" ? safeVoiceSettings.speed : 1;
    const safeSpeed = clamp(rawSpeed, MIN_SPEED, MAX_SPEED);
    if (safeSpeed !== rawSpeed) {
      (safeVoiceSettings as any).speed = safeSpeed;
    }

    // Tomamos idioma: body → audio padre → 'es'
    let locale: Locale = normalizeLocale(language ?? languageCode);
    if (!language && !languageCode) {
      try {
        const parentSnap = await adminDB
          .collection("users")
          .doc(uid)
          .collection("audios")
          .doc(parentAudioId)
          .get();
        const parentLang = parentSnap.exists
          ? (parentSnap.get("language") as string | undefined)
          : undefined;
        locale = normalizeLocale(parentLang ?? "es");
      } catch {
        locale = "es";
      }
    }

    // 2.1) Guard de duración (server-side)
    const { seconds: estSeconds, words, wpm, pauses } = estimateSpeechSeconds(
      text,
      locale,
      safeSpeed
    );

    if (estSeconds > MAX_SEC) {
      const budgetWords = maxWordsFor(MAX_SEC, locale, safeSpeed);

      await gaServerEvent(
        "voice_regeneration_blocked",
        {
          reason: "over_60s",
          est_seconds: Math.round(estSeconds),
          max_seconds: MAX_SEC,
          words,
          budget_words: budgetWords,
          wpm,
          pauses: Math.round(pauses * 100) / 100,
          parentAudioId,
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

    // 🔔 Evento: inicio de regeneración
    await gaServerEvent(
      "voice_regeneration_started",
      {
        parentAudioId,
        voiceId,
        text_length: text.length,
        simulate,
        est_seconds: Math.round(estSeconds),
        locale,
        speed: safeSpeed,
      },
      { userId: uid }
    );

    // 🔁 SIMULACIÓN
    if (simulate) {
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
          language: locale,
          durationHint: estSeconds,
          createdAt: new Date(),
          regenerated: true,
          simulated: true,
        });

      await gaServerEvent(
        "voice_regeneration_completed",
        {
          parentAudioId,
          regenId,
          voiceId,
          simulate: true,
          est_seconds: Math.round(estSeconds),
        },
        { userId: uid }
      );

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
          voice_settings: safeVoiceSettings, // speed ya viene clamped
        }),
      }
    );

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("❌ ElevenLabs regenerate error:", errText);

      await gaServerEvent(
        "voice_regeneration_failed",
        { parentAudioId, error: errText, voiceId },
        { userId: uid }
      );

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
        language: locale,
        durationHint: estSeconds,
        createdAt: new Date(),
        regenerated: true,
      });

    // 🔔 Evento: regeneración completada (real)
    await gaServerEvent(
      "voice_regeneration_completed",
      {
        parentAudioId,
        regenId,
        voiceId,
        simulate: false,
        est_seconds: Math.round(estSeconds),
      },
      { userId: uid }
    );

    return NextResponse.json({
      ok: true,
      regenId,
      audioUrl,
    });
  } catch (e: any) {
    console.error("❌ Error /api/elevenlabs/audio/regenerate:", e?.message, e);

    // Evento de fallo
    const authHeader = req.headers.get("Authorization");
    let uid: string | undefined;
    if (authHeader?.startsWith("Bearer ")) {
      const idToken = authHeader.slice("Bearer ".length);
      const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
      uid = decoded?.uid;
    }

    await gaServerEvent(
      "voice_regeneration_failed",
      { error: e?.message || String(e) },
      uid ? { userId: uid } : undefined
    );

    return NextResponse.json(
      { error: "Error interno", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
