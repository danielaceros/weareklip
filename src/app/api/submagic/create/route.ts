import { NextResponse } from "next/server";
import {
  adminAuth,
  adminDB,
  adminTimestamp,
} from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server";
import { sendEventPush } from "@/lib/sendEventPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  title: string;
  language: string;
  videoUrl: string;
  templateName?: string | null;
  dictionary?: string | null;
  magicZooms?: boolean;
  magicBrolls?: boolean;
  magicBrollsPercentage?: number; // 0..100
};

function appBaseUrl() {
  if (process.env.NODE_ENV === "development") {
    return (
      process.env.NGROK_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000"
    );
  }
  return process.env.NEXT_PUBLIC_BASE_URL || "https://app.viralizalo.ai";
}

export async function POST(req: Request) {
  const simulate = process.env.SIMULATE === "true";
  const idem = req.headers.get("X-Idempotency-Key") ?? crypto.randomUUID();

  try {
    // 1) Auth
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      await gaServerEvent("submagic_failed", { reason: "no_auth_header" });
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const idToken = authHeader.slice("Bearer ".length);
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || "";

    // 2) Body
    const {
      title,
      language,
      videoUrl,
      templateName,
      dictionary,
      magicZooms = true,
      magicBrolls = true,
      magicBrollsPercentage = 70,
    } = (await req.json()) as Body;

    if (!title || !language || !videoUrl) {
      await gaServerEvent("submagic_failed", { uid, reason: "missing_fields" });
      return NextResponse.json(
        { error: "Faltan fields: title, language y videoUrl" },
        { status: 400 }
      );
    }

    // --- Normalizar diccionario ---
    let finalDictionary: string[] = [];
    if (typeof dictionary === "string" && dictionary.trim().length > 0) {
      finalDictionary = dictionary.split(",").map((w) => w.trim()).filter(Boolean);
    }

    // 3) Webhook
    const base = appBaseUrl().replace(/\/$/, "");
    const webhookUrl = `${base}/api/webhook/submagic?uid=${encodeURIComponent(
      uid
    )}&email=${encodeURIComponent(email)}`;

    await gaServerEvent("submagic_attempt", {
      uid,
      title,
      language,
      templateName: templateName ?? null,
      magicZooms,
      magicBrolls,
      magicBrollsPercentage,
    });

    // 4) SIMULACIÓN vs REAL
    let projectId: string;
    let responseData: Record<string, unknown>;

    if (simulate) {
      projectId = crypto.randomUUID();
      responseData = { id: projectId, simulated: true };
      console.log("⚡ Simulación Submagic activada, projectId:", projectId);

      await gaServerEvent("submagic_created_simulated", {
        uid,
        projectId,
        language,
        templateName: templateName ?? null,
      });
    } else {
      const subRes = await fetch("https://api.submagic.co/v1/projects", {
        method: "POST",
        headers: {
          "x-api-key": process.env.SUBMAGIC_API_KEY ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          language,
          videoUrl,
          templateName,
          webhookUrl,
          dictionary: finalDictionary,
          magicZooms,
          magicBrolls,
          magicBrollsPercentage,
        }),
      });

      const raw = await subRes.text();
      try {
        responseData = JSON.parse(raw);
      } catch {
        responseData = { error: "Invalid JSON response from Submagic", raw };
      }

      if (!subRes.ok) {
        await gaServerEvent("submagic_failed", {
          uid,
          title,
          language,
          templateName: templateName ?? null,
          details: responseData,
        });
        return NextResponse.json(
          { error: (responseData as { error?: string }).error || "Error en Submagic", details: responseData },
          { status: subRes.status || 500 }
        );
      }

      projectId = String((responseData as { id?: string }).id ?? "");
      await gaServerEvent("submagic_created", {
        uid,
        projectId,
        language,
        templateName: templateName ?? null,
      });
    }

    // 5) Guardar en Firestore (estado inicial) + notificaciones
    if (projectId) {
      await adminDB
        .collection("users")
        .doc(uid)
        .collection("videos")
        .doc(projectId)
        .set({
          provider: "submagic",
          title,
          language,
          videoUrl,
          templateName: templateName ?? null,
          status: "processing",
          createdAt: adminTimestamp.now(),
          updatedAt: adminTimestamp.now(),
          simulated: simulate,
        });

      // 🔔 In-app + Push
      await Promise.all([
        sendEventPush(uid, "video_uploaded",   { title }),
        sendEventPush(uid, "video_processing", { title }),
      ]);
    }

    // 6) Métrica de uso
    try {
      await fetch(`${base}/api/billing/usage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idem,
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ kind: "edit", idem }),
      });
      await gaServerEvent("usage_recorded", { uid, kind: "edit", projectId });
    } catch (e) {
      console.warn("[submagic/create] usage meter falló:", e);
      await gaServerEvent("usage_failed", { uid, kind: "edit", reason: "usage_meter_failed" });
    }

    return NextResponse.json(responseData, { status: 200 });
  } catch (e: any) {
    console.error("Error /api/submagic/create:", e);
    await gaServerEvent("submagic_failed", { reason: e?.message || "internal_error" });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
