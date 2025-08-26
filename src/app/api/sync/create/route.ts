// src/app/api/sync/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB, adminTimestamp } from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  audioUrl?: string;
  videoUrl?: string;
  options?: Record<string, unknown>;
};

type SyncOk = { id: string; model?: string };

// Type guard
function isSyncOk(x: unknown): x is SyncOk {
  return (
    typeof x === "object" &&
    x !== null &&
    "id" in x &&
    typeof (x as Record<string, unknown>).id === "string"
  );
}

export async function POST(req: NextRequest) {
  const idem = req.headers.get("x-idempotency-key") || crypto.randomUUID();
  const simulate = process.env.SIMULATE === "true";

  try {
    // 1) Auth
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    if (!idToken)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);

    // 2) Body
    const { audioUrl, videoUrl, options } = (await req.json()) as Body;
    if (!audioUrl || !videoUrl) {
      return NextResponse.json(
        { error: "Audio y vídeo son obligatorios" },
        { status: 400 }
      );
    }

    // 🔔 Evento GA4 → inicio
    await gaServerEvent(
      "lipsync_started",
      { audioUrl, videoUrl, options, simulate, idem },
      { userId: uid }
    );

    // 3) Idempotencia
    const col = adminDB.collection("users").doc(uid).collection("lipsync");
    const dupe = await col.where("idem", "==", idem).limit(1).get();
    if (!dupe.empty) {
      const d = dupe.docs[0];
      const data = d.data() as any;
      return NextResponse.json({
        ok: true,
        idempotent: true,
        id: d.id,
        status: data.status ?? "processing",
        resultUrl: data.resultUrl ?? "",
        model: data.model ?? "lipsync-2",
      });
    }

    // 4) URL base
    const baseUrl =
      process.env.NODE_ENV === "development"
        ? (process.env.NGROK_URL || "").replace(/\/$/, "")
        : (process.env.NEXT_PUBLIC_BASE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "").replace(/\/$/, "");
    if (!baseUrl) throw new Error("No está configurada la URL base");

    let jobId: string;
    let model: string;

    // 🔁 RAMA A: SIMULACIÓN
    if (simulate) {
      jobId = crypto.randomUUID();
      model = "lipsync-2";

      await col.doc(jobId).set({
        idem,
        title: `Lipsync (simulado) - ${new Date().toLocaleString()}`,
        status: "processing",
        createdAt: adminTimestamp.now(),
        updatedAt: adminTimestamp.now(),
        audioUrl,
        videoUrl,
        model,
        resultUrl: "",
        simulated: true,
      });
    }

    // 🔁 RAMA B: REAL
    else {
      const webhookUrl = `${baseUrl}/api/webhook/sync?uid=${encodeURIComponent(
        uid
      )}`;

      const syncKey = (process.env.SYNC_API_KEY || "").trim();
      if (!syncKey)
        return NextResponse.json(
          { error: "SYNC_API_KEY no configurada" },
          { status: 500 }
        );

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
          webhookUrl,
        }),
      });

      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        parsed = { error: "Respuesta no JSON" };
      }

      if (!res.ok) {
        console.error("Sync.so error:", res.status, parsed);
        throw new Error(
          (parsed as any)?.error || `Error Sync.so (${res.status})`
        );
      }

      const okData: SyncOk | null = isSyncOk(parsed) ? parsed : null;
      if (!okData) throw new Error("Respuesta inválida de Sync.so");

      jobId = okData.id;
      model = okData.model || "lipsync-2";

      await col.doc(jobId).set({
        idem,
        title: `Lipsync - ${new Date().toLocaleString()}`,
        status: "processing",
        createdAt: adminTimestamp.now(),
        updatedAt: adminTimestamp.now(),
        audioUrl,
        videoUrl,
        model,
        resultUrl: "",
      });
    }

    // 5) Cobro a Stripe (se hace siempre)
    const usageRes = await fetch(`${baseUrl}/api/billing/usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ kind: "lipsync", quantity: 1 }),
    });
    const usageData = await usageRes.json();
    console.log("📊 Billing usage response:", usageRes.status, usageData);

    // 🔔 Evento GA4 → completado (aunque esté en "processing")
    await gaServerEvent(
      "lipsync_completed",
      { jobId, model, simulate, idem },
      { userId: uid }
    );

    return NextResponse.json({
      ok: true,
      id: jobId,
      status: "processing",
      model,
      simulated: simulate,
    });
  } catch (err: any) {
    console.error("❌ Error creando lipsync:", err);

    // Intentar capturar UID si hay token
    let uid: string | undefined;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const idToken = authHeader.split(" ")[1];
      const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
      uid = decoded?.uid;
    }

    // 🔔 Evento GA4 → fallo
    await gaServerEvent(
      "lipsync_failed",
      { error: err?.message || String(err) },
      uid ? { userId: uid } : undefined
    );

    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
