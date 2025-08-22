// src/app/api/webhook/submagic/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function GET() {
  return NextResponse.json({ status: "Webhook endpoint ready" });
}

export async function POST(req: Request) {
  try {
    const { uid } = Object.fromEntries(new URL(req.url).searchParams);
    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 });
    }

    const body = await req.json();
    console.log("📩 Webhook recibido de Submagic:", JSON.stringify(body, null, 2));

    const { projectId, status, title, downloadUrl, duration, completedAt, timestamp } = body;
    if (!projectId || !status) {
      return NextResponse.json({ error: "Missing projectId or status" }, { status: 400 });
    }

    const normalizedStatus = status.toLowerCase();
    const now = new Date().toISOString();

    // 🔍 Buscar lipsync por submagicProjectId
    const lipsyncQuery = await db
      .collection("users")
      .doc(uid)
      .collection("lipsync")
      .where("submagicProjectId", "==", projectId)
      .limit(1)
      .get();

    if (lipsyncQuery.empty) {
      console.warn(`⚠️ No se encontró lipsync con submagicProjectId=${projectId} para el usuario ${uid}`);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const lipsyncDoc = lipsyncQuery.docs[0];
    const lipsyncRef = lipsyncDoc.ref;
    const lipsyncData = lipsyncDoc.data();
    const userEmail = lipsyncData.email;

    console.log(`🔗 Emparejado lipsync docId=${lipsyncDoc.id} para usuario ${uid}`);

    // 📂 Actualizar documento lipsync
    await lipsyncRef.set(
      {
        submagicStatus: normalizedStatus,
        submagicDownloadUrl: downloadUrl || null,
        submagicDuration: duration ?? null,
        submagicCompletedAt: completedAt || lipsyncData.submagicCompletedAt || null,
        submagicUpdatedAt: now,
      },
      { merge: true }
    );

    // 📂 Guardar también en "videos"
    await db
      .collection("users")
      .doc(uid)
      .collection("videos")
      .doc(projectId)
      .set(
        {
          projectId,
          title: title || null,
          status: normalizedStatus,
          downloadUrl: downloadUrl || null,
          duration: duration ?? null,
          completedAt: completedAt || null,
          createdAt: timestamp || now,
          updatedAt: now,
          rawPayload: body,
        },
        { merge: true }
      );

    // 📧 Enviar email si está completado
    if (normalizedStatus === "completed" && downloadUrl && userEmail) {
      console.log(`📧 Enviando email a ${userEmail} con enlace ${downloadUrl}`);

      const baseUrl =
        process.env.NODE_ENV === "development"
          ? "http://localhost:3000"
          : "https://app.viralizalo.ai";

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
