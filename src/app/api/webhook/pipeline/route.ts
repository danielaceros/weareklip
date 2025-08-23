// src/app/api/webhook/pipeline/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

interface WebhookBody {
  id?: string;
  projectId?: string;
  status?: string;
  outputUrl?: string;
  outputDuration?: number;
  model?: string;
}

interface UpdateData {
  status: string;
  updatedAt: Date;
  downloadUrl?: string;
  duration?: number | null;
  model?: string | null;
  completedAt?: Date;
  submagicProjectId?: string;
}

export async function POST(req: Request) {
  try {
    const { uid } = Object.fromEntries(new URL(req.url).searchParams);
    if (!uid) {
      return NextResponse.json({ error: "UID requerido" }, { status: 400 });
    }

    const body = (await req.json()) as WebhookBody;
    console.log("🎤 Webhook lipsync recibido:", body);

    const projectId = body.id || body.projectId;
    if (!projectId) {
      return NextResponse.json({ error: "ID de proyecto no encontrado" }, { status: 400 });
    }

    const lipsyncRef = db
      .collection("users")
      .doc(uid)
      .collection("lipsync")
      .doc(projectId);

    const updateData: UpdateData = {
      status: body.status?.toLowerCase() || "unknown",
      updatedAt: new Date(),
    };

    // 🔹 Si el lipsync terminó correctamente
    if (body.status?.toLowerCase() === "completed" && body.outputUrl) {
      updateData.downloadUrl = body.outputUrl;
      updateData.duration = body.outputDuration ?? null;
      updateData.model = body.model ?? null;
      updateData.completedAt = new Date();

      // Obtener parámetros previos de Firestore
      const snap = await lipsyncRef.get();
      if (snap.exists) {
        const docData = snap.data() || {};
        const { subLang, template, email } = docData;

        if (email) {
          try {
            const baseUrl =
              process.env.NODE_ENV === "development"
                ? process.env.NGROK_URL || "http://localhost:3000"
                : "https://app.viralizalo.ai";

            const webhookUrl = `${baseUrl}/api/webhook/submagic?uid=${uid}`;

            console.log("🚀 Enviando a Submagic con webhook:", webhookUrl);

            const submagicRes = await fetch("https://api.submagic.co/v1/projects", {
              method: "POST",
              headers: {
                "x-api-key": process.env.SUBMAGIC_API_KEY!,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                title: `Lipsync Edit - ${new Date().toLocaleString()}`,
                language: subLang || "es",
                videoUrl: body.outputUrl,
                templateName: template || undefined,
                webhookUrl,
                magicZooms: true,
                magicBrolls: true,
                magicBrollsPercentage: 70,
              }),
            });

            const submagicData = await submagicRes.json();

            if (submagicRes.ok && submagicData?.id) {
              updateData.submagicProjectId = submagicData.id;
              console.log("✅ Guardado submagicProjectId:", submagicData.id);

              // Guardar inmediatamente para que el webhook de Submagic lo encuentre
              await lipsyncRef.set({ submagicProjectId: submagicData.id }, { merge: true });
            } else {
              console.error("❌ Error en Submagic:", submagicData);
            }
          } catch (err) {
            console.error("⚠️ Error interno llamando a Submagic:", err);
          }
        }
      }
    }

    // 💾 Guardar todo en Firestore (incluyendo submagicProjectId si existe)
    await lipsyncRef.set(updateData, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("💥 Error en webhook lipsync:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
