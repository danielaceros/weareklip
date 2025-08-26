// src/app/api/webhook/submagic/route.ts
import { NextResponse } from "next/server";
import { adminDB, adminTimestamp } from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server"; // 👈 añadido

export async function GET() {
  return NextResponse.json({ status: "Webhook endpoint ready" });
}

export async function POST(req: Request) {
  const simulate = process.env.SIMULATE === "true";

  try {
    const { uid } = Object.fromEntries(new URL(req.url).searchParams);
    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 });
    }

    if (simulate) {
      // Usa el mismo projectId que viene en el query o genera uno si falta
      const fakeId = `submagic_${Date.now()}`;
      const now = adminTimestamp.now();

      // 1) Actualiza lipsync
      await adminDB
        .collection("users")
        .doc(uid)
        .collection("lipsync")
        .doc(fakeId)
        .set(
          {
            submagicProjectId: fakeId,
            submagicStatus: "completed",
            submagicDownloadUrl: "https://fake.local/video-submagic.mp4",
            submagicDuration: 30,
            submagicCompletedAt: now,
            submagicUpdatedAt: now,
            createdAt: now,
            updatedAt: now,
            simulated: true,
          },
          { merge: true }
        );

      // 2) Guarda también en videos (👈 lo que faltaba que se vea en mock)
      await adminDB
        .collection("users")
        .doc(uid)
        .collection("videos")
        .doc(fakeId)
        .set(
          {
            projectId: fakeId,
            title: "Simulated Submagic Video",
            status: "completed",
            downloadUrl: "https://fake.local/video-submagic.mp4",
            duration: 30,
            completedAt: now,
            createdAt: now,
            updatedAt: now,
            simulated: true,
          },
          { merge: true }
        );

      console.log("🟢 Webhook Submagic simulado guardado en lipsync y videos:", fakeId);
      await gaServerEvent("submagic_webhook_simulated", { uid, projectId: fakeId }); // 👈 evento
      return NextResponse.json({ ok: true, simulated: true });
    }

    // 🔁 Rama real
    const body = await req.json();
    console.log("📩 Webhook recibido de Submagic:", JSON.stringify(body, null, 2));
    await gaServerEvent("submagic_webhook_received", { uid, body }); // 👈 evento

    const {
      projectId,
      status,
      title,
      downloadUrl,
      duration,
      completedAt,
      timestamp,
    } = body;

    if (!projectId || !status) {
      return NextResponse.json(
        { error: "Missing projectId or status" },
        { status: 400 }
      );
    }

    const normalizedStatus = String(status).toLowerCase();
    const now = adminTimestamp.now();

    // 🔍 Buscar lipsync por submagicProjectId
    const lipsyncQuery = await adminDB
      .collection("users")
      .doc(uid)
      .collection("lipsync")
      .where("submagicProjectId", "==", projectId)
      .limit(1)
      .get();

    let userEmail: string | null = null;
    if (!lipsyncQuery.empty) {
      const lipsyncDoc = lipsyncQuery.docs[0];
      const lipsyncRef = lipsyncDoc.ref;
      const lipsyncData = lipsyncDoc.data();
      userEmail = (lipsyncData as any).email;

      console.log(
        `🔗 Emparejado lipsync docId=${lipsyncDoc.id} para usuario ${uid}`
      );

      // 📂 Actualizar documento lipsync
      await lipsyncRef.set(
        {
          submagicStatus: normalizedStatus,
          submagicDownloadUrl: downloadUrl || null,
          submagicDuration: duration ?? null,
          submagicCompletedAt:
            completedAt || lipsyncData.submagicCompletedAt || null,
          submagicUpdatedAt: now,
        },
        { merge: true }
      );

      await gaServerEvent("submagic_lipsync_updated", { uid, projectId, status: normalizedStatus }); // 👈 evento
    } else {
      console.warn(
        `⚠️ No se encontró lipsync con submagicProjectId=${projectId} para el usuario ${uid}`
      );
      await gaServerEvent("submagic_lipsync_missing", { uid, projectId }); // 👈 evento
    }

    // 📂 Guardar también en "videos"
    await adminDB
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
          createdAt: timestamp
            ? adminTimestamp.fromMillis(Date.parse(timestamp))
            : now,
          updatedAt: now,
          rawPayload: body,
        },
        { merge: true }
      );

    await gaServerEvent("submagic_video_saved", { uid, projectId, status: normalizedStatus }); // 👈 evento

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

      await gaServerEvent("submagic_email_sent", { uid, projectId, to: userEmail }); // 👈 evento
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ Error processing Submagic webhook:", error);
    await gaServerEvent("submagic_webhook_failed", { error: String(error) }); // 👈 evento
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
