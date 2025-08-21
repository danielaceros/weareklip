// src/app/api/elevenlabs/audio/create/route.ts
import { NextResponse } from "next/server";
import { db, auth, bucket as storage } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";

export async function POST(req: Request) {
  try {
    // 🔹 Autenticación Firebase
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // 🔹 Datos recibidos
    const { text, voiceId, language_code, voice_settings } = await req.json();

    if (!text || !voiceId || !language_code) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    // 🔹 Extraer voice_settings con valores por defecto
    const {
      stability = 0.5,
      similarity_boost = 0.75,
      style = 0,
      speed = 1.0,
      use_speaker_boost = true,
    } = voice_settings || {};

    // 🔹 Verificar que la voz pertenece al usuario
    const voiceDoc = await db
      .collection("users")
      .doc(uid)
      .collection("voices")
      .doc(voiceId)
      .get();

    if (!voiceDoc.exists) {
      return NextResponse.json(
        { error: "Voz no encontrada o no autorizada" },
        { status: 403 }
      );
    }

    // 🔹 Llamada a ElevenLabs API
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2", // ✅ sin language_code
          voice_settings: {
            stability,
            similarity_boost,
            style,
            speed,
            use_speaker_boost,
          },
        }),
      }
    );

    if (!elevenRes.ok) {
      const errorText = await elevenRes.text();
      console.error("ElevenLabs error:", errorText);
      return NextResponse.json(
        { error: "Error al generar audio" },
        { status: 500 }
      );
    }

    const audioBuffer = Buffer.from(await elevenRes.arrayBuffer());

    // 🔹 Subir a Firebase Storage
    const audioId = uuidv4();
    const filePath = `users/${uid}/audios/${audioId}.mp3`;
    const file = storage.file(filePath);

    await file.save(audioBuffer, {
      contentType: "audio/mpeg",
      metadata: {
        firebaseStorageDownloadTokens: audioId,
      },
    });

    // 🔹 Generar URL pública correcta
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "klip-6e9a8.firebasestorage.app";
    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
      filePath
    )}?alt=media&token=${audioId}`;

    // 🔹 Guardar metadatos en Firestore
    await db
      .collection("users")
      .doc(uid)
      .collection("audios")
      .doc(audioId)
      .set({
        text,
        voiceId,
        language_code,
        stability,
        similarity_boost,
        style,
        speed,
        use_speaker_boost,
        audioUrl: downloadURL,
        createdAt: new Date(),
      });

    return NextResponse.json({ audioUrl: downloadURL, audioId });
  } catch (error) {
    console.error("Error en /api/elevenlabs/audio/create:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
