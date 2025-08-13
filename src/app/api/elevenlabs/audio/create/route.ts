// src/app/api/audio/create/route.ts
import { NextResponse } from "next/server";
import { db, auth, storage } from "@/lib/firebase-admin";
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
    const {
      text,
      voiceId,
      language_code,
      stability,
      similarity_boost,
      style,
      speed,
      use_speaker_boost,
    } = await req.json();

    if (!text || !voiceId || !language_code) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // 🔹 Verificar que la voz pertenece al usuario
    const voiceDoc = await db
      .collection("users")
      .doc(uid)
      .collection("voices")
      .doc(voiceId)
      .get();

    if (!voiceDoc.exists) {
      return NextResponse.json({ error: "Voz no encontrada o no autorizada" }, { status: 403 });
    }

    // 🔹 Llamada a ElevenLabs API
    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        language_code,
        voice_settings: {
          stability: stability ?? 0.5,
          similarity_boost: similarity_boost ?? 0.75,
          style: style ?? 0,
          speed: speed ?? 1.0,
          use_speaker_boost: use_speaker_boost ?? true,
        },
      }),
    });

    if (!elevenRes.ok) {
      const errorText = await elevenRes.text();
      console.error("ElevenLabs error:", errorText);
      return NextResponse.json({ error: "Error al generar audio" }, { status: 500 });
    }

    const audioBuffer = Buffer.from(await elevenRes.arrayBuffer());

    // 🔹 Subir a Firebase Storage
    const audioId = uuidv4();
    const filePath = `users/${uid}/audios/${audioId}.mp3`;
    const file = storage.file(filePath);

    await file.save(audioBuffer, {
      contentType: "audio/mpeg",
      metadata: {
        firebaseStorageDownloadTokens: audioId, // 🔹 token público
      },
    });

    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${storage.name}/o/${encodeURIComponent(
      filePath
    )}?alt=media&token=${audioId}`;

    // 🔹 Guardar metadatos en Firestore
    await db.collection("users").doc(uid).collection("audios").doc(audioId).set({
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
    console.error("Error en /api/audio/create:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
