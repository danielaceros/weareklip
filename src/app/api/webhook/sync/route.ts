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
}

export async function POST(req: Request) {
  try {
    const { uid } = Object.fromEntries(new URL(req.url).searchParams);
    if (!uid) {
      return NextResponse.json({ error: "UID requerido" }, { status: 400 });
    }

    const body = (await req.json()) as WebhookBody;
    console.log("Webhook lipsync recibido:", body);

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

    if (body.status === "COMPLETED" && body.outputUrl) {
      updateData.downloadUrl = body.outputUrl;
      updateData.duration = body.outputDuration ?? null;
      updateData.model = body.model ?? null;
      updateData.completedAt = new Date();
    }

    await lipsyncRef.set(updateData, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Error en webhook lipsync:", err);
    const message =
      err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
