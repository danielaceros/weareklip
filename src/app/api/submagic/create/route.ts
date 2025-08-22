// src/app/api/submagic/create/route.ts
import { NextResponse } from "next/server";
import {
  adminAuth,
  adminDB,
  adminTimestamp,
} from "@/lib/firebase-admin";

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
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://app.weareklip.com"
  );
}

export async function POST(req: Request) {
  try {
    // 1) Auth
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const idToken = authHeader.slice("Bearer ".length);
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || "";

    // 2) Cuerpo
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
      return NextResponse.json(
        { error: "Faltan fields: title, language y videoUrl" },
        { status: 400 }
      );
    }

    // 3) Webhook
    const base = appBaseUrl();
    const webhookUrl = `${base}/api/webhook/submagic?uid=${encodeURIComponent(
      uid
    )}&email=${encodeURIComponent(email)}`;

    // 4) Llamada a Submagic
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
        dictionary: dictionary ?? null,
        magicZooms,
        magicBrolls,
        magicBrollsPercentage,
      }),
    });

    const raw = await subRes.text();
    let data: { id?: string; [k: string]: unknown };
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: "Invalid JSON response from Submagic", raw };
    }

    if (!subRes.ok) {
      return NextResponse.json(
        { error: (data as { error?: string }).error || "Error en Submagic", details: data },
        { status: subRes.status || 500 }
      );
    }

    const projectId = String(data.id ?? "");

    // 5) Guardar en Firestore (estado inicial)
    if (projectId) {
      await adminDB
        .collection("users")
        .doc(uid)
        .collection("edits")
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
        });
    }

    // 6) Métrica de uso (idempotente)
    const idem = req.headers.get("X-Idempotency-Key") ?? crypto.randomUUID();
    try {
      await fetch(`${base}/api/billing/usage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idem,
        },
        body: JSON.stringify({ kind: "edit" }),
      });
    } catch (e) {
      // No rompe el flujo si falla la métrica
      console.warn("[submagic/create] usage meter falló:", e);
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error("Error /api/submagic/create:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
