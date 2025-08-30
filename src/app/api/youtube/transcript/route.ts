import { NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";
import { FormData } from "formdata-node";
import { Blob } from "buffer";
import { gaServerEvent } from "@/lib/ga-server"; // 👈 evento GA4
import { adminAuth } from "@/lib/firebase-admin"; // 👈 Autenticación Firebase

export async function GET(request: Request) {
  const simulate = process.env.SIMULATE === "true";
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  // 1️⃣ Verificar autenticación (solo usuarios autenticados pueden transcribir)
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idToken = authHeader.slice("Bearer ".length);
  try {
    // Verificación de token de usuario
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid; // Usuario autenticado
  } catch (err) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2️⃣ Validación de ID (asegurarnos de que no sea malicioso)
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
  }

  // 🔁 SIMULACIÓN
  if (simulate) {
    console.log("🟢 Transcript simulado para id:", id);
    await gaServerEvent("transcribe_simulated", { id }); // 👈 evento
    return NextResponse.json({
      transcript: `Este es un transcript simulado del vídeo ${id}.`,
      simulated: true,
    });
  }

  // 🔁 REAL
  try {
    const audioStream = ytdl(id, {
      quality: "lowestaudio",
      filter: "audioonly",
    });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk as Buffer);
    }
    const audioBuffer = Buffer.concat(chunks);

    const blob = new Blob([audioBuffer], { type: "audio/mpeg" });

    const form = new FormData();
    form.set("file", blob, `${id}.mp3`);
    form.set("model", "whisper-1");
    form.set("language", "es");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
      },
      body: form as unknown as BodyInit,
    });

    if (!res.ok) {
      throw new Error(`OpenAI error: ${await res.text()}`);
    }

    const data: { text?: string } = await res.json();
    await gaServerEvent("transcribe_success", { id, textLength: data.text?.length ?? 0 }); // 👈 evento
    return NextResponse.json({ transcript: data.text || "" });
  } catch (err: unknown) {
    console.error("Transcript error:", err);
    await gaServerEvent("transcribe_failed", { id, error: err instanceof Error ? err.message : String(err) }); // 👈 evento
    return NextResponse.json({ transcript: "" }, { status: 500 });
  }
}
