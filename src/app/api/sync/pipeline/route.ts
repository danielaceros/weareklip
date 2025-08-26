// src/app/api/sync/pipeline/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDB, adminTimestamp } from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const simulate = process.env.SIMULATE === "true";
  const idem = crypto.randomUUID();

  try {
    // 1️⃣ Autenticación
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    if (!idToken)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(idToken);

    // 2️⃣ Body
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

    // 🔔 Evento GA4 → inicio del pipeline
    await gaServerEvent(
      "pipeline_started",
      {
        audioUrl,
        videoUrl,
        subLang,
        template,
        magicZooms,
        magicBrolls,
        magicBrollsPercentage,
        simulate,
        idem,
      },
      { userId: decoded.uid }
    );

    // 3️⃣ URL base
    const baseUrl =
      process.env.NODE_ENV === "development"
        ? (process.env.NGROK_URL || "http://localhost:3000").replace(/\/$/, "")
        : (process.env.NEXT_PUBLIC_BASE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "").replace(/\/$/, "");
    if (!baseUrl) throw new Error("No está configurada la URL base");

    let jobId: string;
    let model = "lipsync-2";

    // 🔁 RAMA A: SIMULACIÓN
    if (simulate) {
      jobId = crypto.randomUUID();
      const now = adminTimestamp.now();

      await adminDB
        .collection("users")
        .doc(decoded.uid)
        .collection("lipsync")
        .doc(jobId)
        .set({
          title: `Lipsync (simulado) - ${new Date().toLocaleString()}`,
          status: "processing",
          createdAt: now,
          updatedAt: now,
          audioUrl,
          videoUrl,
          model,
          subLang: subLang || null,
          template: template || null,
          dictionary: dictionary || null,
          magicZooms: magicZooms ?? false,
          magicBrolls: magicBrolls ?? false,
          magicBrollsPercentage:
            typeof magicBrollsPercentage === "number" ? magicBrollsPercentage : 50,
          email: decoded.email || null,
          uid: decoded.uid,
          simulated: true,
        });

      // ⚡ Cobrar uso aunque sea simulado
      const usageUrl = new URL("/api/billing/usage", req.url).toString();
      const usageRes = await fetch(usageUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader!,
          "X-Idempotency-Key": idem,
        },
        body: JSON.stringify({ kind: "lipsync", quantity: 1, idem }),
      });
      let usage: any = {};
      try {
        usage = await usageRes.json();
      } catch {}
      if (!usageRes.ok || usage.ok !== true) {
        console.error("❌ Error registrando uso lipsync (simulado):", usage);
      }

      // 2️⃣ Disparar webhook de pipeline simulado
      await fetch(`${baseUrl}/api/webhook/pipeline?uid=${decoded.uid}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader!,
        },
        body: JSON.stringify({
          id: jobId,
          status: "completed",
          outputUrl: "https://fake.local/output-lipsync.mp4",
          outputDuration: 30,
          model,
        }),
      }).catch((err) =>
        console.error("❌ Error simulando webhook pipeline:", err)
      );

      // 🔔 Evento GA4 → completado (simulado)
      await gaServerEvent(
        "pipeline_completed",
        { jobId, model, simulate: true, idem },
        { userId: decoded.uid }
      );

      return NextResponse.json({
        ok: true,
        id: jobId,
        status: "processing",
        model,
        simulated: true,
      });
    }

    // 🔁 RAMA B: REAL
    const webhookUrl = `${baseUrl}/api/webhook/pipeline?uid=${encodeURIComponent(
      decoded.uid
    )}`;

    const res = await fetch("https://api.sync.so/v2/generate", {
      method: "POST",
      headers: {
        "x-api-key": process.env.SYNC_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
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

    jobId = data.id;
    model = data.model || "lipsync-2";

    // 5️⃣ Guardar en Firestore
    await adminDB
      .collection("users")
      .doc(decoded.uid)
      .collection("lipsync")
      .doc(jobId)
      .set({
        title: `Lipsync - ${new Date().toLocaleString()}`,
        status: "processing",
        createdAt: adminTimestamp.now(),
        updatedAt: adminTimestamp.now(),
        audioUrl,
        videoUrl,
        model,
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

    // ⚡ Cobrar uso también en la rama real
    const usageUrl = new URL("/api/billing/usage", req.url).toString();
    const usageRes = await fetch(usageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader!,
        "X-Idempotency-Key": idem,
      },
      body: JSON.stringify({ kind: "lipsync", quantity: 1, idem }),
    });
    let usage: any = {};
    try {
      usage = await usageRes.json();
    } catch {}
    if (!usageRes.ok || usage.ok !== true) {
      console.error("❌ Error registrando uso lipsync:", usage);
    }

    // 🔔 Evento GA4 → completado (real)
    await gaServerEvent(
      "pipeline_completed",
      { jobId, model, simulate: false, idem },
      { userId: decoded.uid }
    );

    // 6️⃣ Respuesta
    return NextResponse.json({
      ok: true,
      id: jobId,
      status: "processing",
      model,
      simulated: false,
    });
  } catch (err: any) {
    console.error("❌ Error creando lipsync:", err);

    // Intentar recuperar UID para GA
    let uid: string | undefined;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const idToken = authHeader.split(" ")[1];
      const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
      uid = decoded?.uid;
    }

    // 🔔 Evento GA4 → fallo
    await gaServerEvent(
      "pipeline_failed",
      { error: err?.message || String(err) },
      uid ? { userId: uid } : undefined
    );

    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
