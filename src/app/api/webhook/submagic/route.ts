// src/app/api/webhook/submagic/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function GET() {
  return NextResponse.json({ status: "Webhook endpoint ready" });
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");
    const userEmail = searchParams.get("email");

    if (!uid || !userEmail) {
      return NextResponse.json({ error: "Missing uid or email" }, { status: 400 });
    }

    const body = await req.json();

    console.log("======================================");
    console.log("📩 Webhook recibido de Submagic");
    console.log("🔹 UID:", uid);
    console.log("🔹 Email:", userEmail);
    console.log("🔹 Payload completo:", JSON.stringify(body, null, 2));
    console.log("======================================");

    const {
      projectId,
      status,
      title,
      downloadUrl,
      duration,
      completedAt,
      timestamp
    } = body;

    if (!projectId || !status) {
      return NextResponse.json({ error: "Missing projectId or status" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 📂 Guardar en Firestore con más info
    await db
      .collection("users")
      .doc(uid)
      .collection("videos")
      .doc(projectId)
      .set(
        {
          projectId,
          title: title || null,
          status: status.toLowerCase(),
          downloadUrl: downloadUrl || null,
          duration: duration || null,
          completedAt: completedAt || null,
          createdAt: timestamp || now,
          updatedAt: now,
          rawPayload: body
        },
        { merge: true }
      );

    // 📧 Enviar email si está completado
    const baseUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "https://app.weareklip.com";

    if (status.toLowerCase() === "completed" && downloadUrl) {
      console.log(`📧 Enviando email a ${userEmail} con enlace ${downloadUrl}`);

      await fetch(`${baseUrl}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: userEmail,
          subject: "🎬 Tu vídeo de Submagic está listo",
          content: `Hola,<br><br>
            Tu vídeo ya está procesado y listo para descargar:<br><br>
            <a href="${downloadUrl}" target="_blank">${downloadUrl}</a><br><br>
            Gracias por usar KLIP`,
        }),
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ Error processing Submagic webhook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
