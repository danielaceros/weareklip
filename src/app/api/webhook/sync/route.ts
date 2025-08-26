// src/app/api/webhook/pipeline/route.ts
import { NextResponse } from "next/server";
import { adminDB, adminTimestamp } from "@/lib/firebase-admin";

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
  updatedAt: FirebaseFirestore.Timestamp;
  downloadUrl?: string;
  duration?: number | null;
  model?: string | null;
  completedAt?: FirebaseFirestore.Timestamp;
}

export async function POST(req: Request) {
  const simulate = process.env.SIMULATE === "true";

  try {
    // 1️⃣ Validar UID
    const { uid } = Object.fromEntries(new URL(req.url).searchParams);
    if (!uid) {
      return NextResponse.json({ error: "UID requerido" }, { status: 400 });
    }

    // 🔁 SIMULACIÓN
    if (simulate) {
      const fakeId = `pipeline_${Date.now()}`;
      const now = adminTimestamp.now();

      const lipsyncRef = adminDB
        .collection("users")
        .doc(uid)
        .collection("lipsync")
        .doc(fakeId);

      const fakeData: UpdateData = {
        status: "completed",
        updatedAt: now,
        downloadUrl: "https://fake.local/lipsync.mp4",
        duration: 42,
        model: "lipsync-2",
        completedAt: now,
      };

      await lipsyncRef.set(fakeData, { merge: true });

      console.log("🟢 Webhook pipeline simulado guardado:", fakeId);
      return NextResponse.json({ ok: true, simulated: true, id: fakeId });
    }

    // 🔁 REAL
    const body = (await req.json()) as WebhookBody;
    console.log("🎤 Webhook lipsync recibido:", body);

    const projectId = body.id || body.projectId;
    if (!projectId) {
      return NextResponse.json(
        { error: "ID de proyecto no encontrado" },
        { status: 400 }
      );
    }

    const lipsyncRef = adminDB
      .collection("users")
      .doc(uid)
      .collection("lipsync")
      .doc(projectId);

    const updateData: UpdateData = {
      status: body.status?.toLowerCase() || "unknown",
      updatedAt: adminTimestamp.now(),
    };

    if (body.status?.toLowerCase() === "completed" && body.outputUrl) {
      updateData.downloadUrl = body.outputUrl;
      updateData.duration = body.outputDuration ?? null;
      updateData.model = body.model ?? null;
      updateData.completedAt = adminTimestamp.now();
    }

    await lipsyncRef.set(updateData, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("❌ Error en webhook lipsync:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
