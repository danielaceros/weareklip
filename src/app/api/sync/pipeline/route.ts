// src/app/api/pipeline/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDB, adminTimestamp } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 1️⃣ Autenticación
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    if (!idToken)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(idToken);

    // 2️⃣ Validar body
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

    // 3️⃣ URL base para webhook
    const baseUrl =
      process.env.NODE_ENV === "development"
        ? (process.env.NGROK_URL || "http://localhost:3000").replace(/\/$/, "")
        : (process.env.NEXT_PUBLIC_BASE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "").replace(/\/$/, "");
    if (!baseUrl) throw new Error("No está configurada la URL base");

    const webhookUrl = `${baseUrl}/api/webhook/pipeline?uid=${encodeURIComponent(
      decoded.uid
    )}`;

    // 4️⃣ Llamada a Sync.so
    const res = await fetch("https://api.sync.so/v2/generate", {
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

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error en Sync.so");

    // 5️⃣ Guardar en Firestore
    if (data.id) {
      await adminDB
        .collection("users")
        .doc(decoded.uid)
        .collection("lipsync")
        .doc(data.id)
        .set({
          title: `Lipsync - ${new Date().toLocaleString()}`,
          status: "processing",
          createdAt: adminTimestamp.now(),
          updatedAt: adminTimestamp.now(),
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
          email: decoded.email || null,
          uid: decoded.uid,
        });
    }

    // 6️⃣ Respuesta
    return NextResponse.json(data);
  } catch (err) {
    console.error("❌ Error creando lipsync:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
