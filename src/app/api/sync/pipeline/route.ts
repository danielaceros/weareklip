// src/app/api/pipeline/route.ts
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { initAdmin, db } from "@/lib/firebase-admin";

initAdmin();

export async function POST(req: Request) {
  try {
    // 1️⃣ Autenticación
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await getAuth().verifyIdToken(idToken);

    // 2️⃣ Validar y recibir datos
    const {
      audioUrl,
      videoUrl,
      subLang,
      template,
      dictionary,
      magicZooms,
      magicBrolls,
      magicBrollsPercentage,
    } = await req.json();

    if (!audioUrl || !videoUrl) {
      return NextResponse.json(
        { error: "Audio y vídeo son obligatorios" },
        { status: 400 }
      );
    }

    // 3️⃣ Detectar URL base para el webhook
    const baseUrl =
      process.env.NODE_ENV === "development"
        ? process.env.NGROK_URL || "http://localhost:3000"
        : process.env.NEXT_PUBLIC_BASE_URL;

    if (!baseUrl) {
      throw new Error("No está configurada la URL base");
    }

    const webhookUrl = `${baseUrl}/api/webhook/pipeline?uid=${decoded.uid}`;

    // 4️⃣ Petición directa a Sync.so
    const syncRes = await fetch("https://api.sync.so/v2/generate", {
      method: "POST",
      headers: {
        "x-api-key": process.env.SYNC_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "lipsync-2",
        input: [
          { type: "video", url: videoUrl },
          { type: "audio", url: audioUrl },
        ],
        options: { sync_mode: "loop" },
        webhookUrl,
      }),
    });

    const data = await syncRes.json();
    if (!syncRes.ok) throw new Error(data.error || "Error en Sync.so");

    // 5️⃣ Guardar en Firestore (incluyendo datos para el paso de Submagic)
    if (data.id) {
      await db
        .collection("users")
        .doc(decoded.uid)
        .collection("lipsync")
        .doc(data.id)
        .set({
          title: `Lipsync - ${new Date().toLocaleString()}`,
          status: "processing",
          createdAt: new Date(),
          audioUrl,
          videoUrl,
          model: data.model || "lipsync-2",
          subLang: subLang || null,
          template: template || null,
          dictionary: dictionary || null,
          magicZooms: magicZooms ?? false,
          magicBrolls: magicBrolls ?? false,
          magicBrollsPercentage:
            typeof magicBrollsPercentage === "number"
              ? magicBrollsPercentage
              : 50,
          // 🔹 Guardamos email y uid para el webhook
          email: decoded.email || null,
          uid: decoded.uid,
        });
    }

    // 6️⃣ Responder al cliente
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Error creando vídeo lipsync directo:", err);
    const message =
      err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
