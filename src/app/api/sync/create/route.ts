// src/app/api/sync/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB, adminTimestamp } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  audioUrl?: string;
  videoUrl?: string;
  options?: Record<string, unknown>;
};

type SyncOk = { id: string; model?: string };

// Type guard para la respuesta OK de Sync
function isSyncOk(x: unknown): x is SyncOk {
  return (
    typeof x === "object" &&
    x !== null &&
    "id" in x &&
    typeof (x as Record<string, unknown>).id === "string"
  );
}

export async function POST(req: NextRequest) {
  // Idempotencia: si el cliente no manda key, generamos una
  const idem = req.headers.get("x-idempotency-key") || crypto.randomUUID();

  try {
    // 1) Auth Firebase
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    if (!idToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { uid } = await adminAuth.verifyIdToken(idToken);

    // 2) Body
    const { audioUrl, videoUrl, options } = (await req.json()) as Body;
    if (!audioUrl || !videoUrl) {
      return NextResponse.json(
        { error: "Audio y vídeo son obligatorios" },
        { status: 400 }
      );
    }

    // 3) Idempotencia: si ya existe, devolvemos ese job
    const col = adminDB.collection("users").doc(uid).collection("lipsync");
    const dupe = await col.where("idem", "==", idem).limit(1).get();
    if (!dupe.empty) {
      const d = dupe.docs[0];
      const data = d.data() as {
        status?: string;
        resultUrl?: string;
        model?: string;
      };
      return NextResponse.json({
        ok: true,
        idempotent: true,
        id: d.id,
        status: data.status ?? "processing",
        resultUrl: data.resultUrl ?? "",
        model: data.model ?? "lipsync-2",
      });
    }

    // 4) URL base para webhook
    const baseUrl =
      process.env.NODE_ENV === "development"
        ? (process.env.NGROK_URL || "").replace(/\/$/, "")
        : (process.env.NEXT_PUBLIC_BASE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "").replace(/\/$/, "");
    if (!baseUrl) {
      throw new Error(
        "No está configurada la URL base para el webhook (NGROK_URL / NEXT_PUBLIC_BASE_URL / NEXT_PUBLIC_APP_URL)"
      );
    }
    const webhookUrl = `${baseUrl}/api/webhook/sync?uid=${encodeURIComponent(
      uid
    )}`;

    // 5) Llamada a Sync
    const syncKey = (process.env.SYNC_API_KEY || "").trim();
    if (!syncKey) {
      return NextResponse.json(
        { error: "SYNC_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const res = await fetch("https://api.sync.so/v2/generate", {
      method: "POST",
      headers: {
        "x-api-key": syncKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "lipsync-2",
        input: [
          { type: "video", url: videoUrl },
          { type: "audio", url: audioUrl },
        ],
        options: { sync_mode: "loop", ...(options || {}) },
        webhookUrl,        // camelCase
        webhook_url: webhookUrl, // por si la API usa snake_case
      }),
    });

    // Parse seguro de la respuesta
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      const txt = await res.text().catch(() => "");
      parsed = { error: txt || "Respuesta no JSON" };
    }

    if (!res.ok) {
      const errMsg =
        (typeof parsed === "object" &&
          parsed !== null &&
          "error" in parsed &&
          typeof (parsed as Record<string, unknown>).error === "string" &&
          (parsed as Record<string, string>).error) ||
        "Error en Sync.so";
      throw new Error(errMsg);
    }

    const okData: SyncOk | null = isSyncOk(parsed) ? parsed : null;
    if (!okData) {
      // Si la API no devuelve la forma esperada
      throw new Error("Respuesta inválida de Sync.so");
    }

    // 6) Persistir job como processing
    const jobId = okData.id ?? crypto.randomUUID();
    const model = typeof okData.model === "string" ? okData.model : "lipsync-2";

    await col.doc(jobId).set({
      idem,
      title: `Lipsync - ${new Date().toLocaleString()}`,
      status: "processing",
      createdAt: adminTimestamp.now(),
      updatedAt: adminTimestamp.now(),
      audioUrl,
      videoUrl,
      model,
      resultUrl: "", // se rellenará en el webhook
    });

    // 7) Cobro (fire&forget)
    const baseForUsage =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
      (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
    if (baseForUsage) {
      fetch(`${baseForUsage}/api/billing/usage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ kind: "lipsync", quantity: 1 }),
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      id: jobId,
      status: "processing",
      model,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("Error creando vídeo lipsync:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
