import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { initAdmin, adminAuth } from "@/lib/firebase-admin";
import { FormData, File as FormDataFile } from "formdata-node";
import { FormDataEncoder } from "form-data-encoder";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";

initAdmin();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY!;
const ELEVEN_ADD_VOICE_URL = "https://api.elevenlabs.io/v1/voices/add";

function filenameFromPath(path: string, contentType?: string) {
  const base = path.split("/").pop() || "sample";
  if (base.includes(".")) return base;
  const ext = contentType?.split("/")[1] || "dat";
  return `${base}.${ext}`;
}

export async function POST(req: NextRequest) {
  if (!ELEVEN_KEY) {
    return NextResponse.json(
      { error: "Falta ELEVENLABS_API_KEY en el entorno" },
      { status: 500 }
    );
  }

  try {
    // 1) Auth obligatoria (necesitamos uid para limitar/lockear)
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    const { uid } = await adminAuth.verifyIdToken(idToken);

    const db = admin.firestore();

    // 2) Idempotencia por click
    const idem = req.headers.get("x-idempotency-key") || randomUUID();
    const lockRef = db
      .collection("users")
      .doc(uid)
      .collection("idempotency")
      .doc(`voice_create_${idem}`);

    try {
      // .create() falla si el doc ya existe -> evita duplicados
      await lockRef.create({
        type: "voice_create",
        status: "pending",
        createdAt: new Date(),
      });
    } catch {
      return NextResponse.json(
        { ok: false, duplicate: true, message: "Operación ya en curso" },
        { status: 409 }
      );
    }

    // 3) Límite de plan: solo 1 voz por usuario
    const existing = await db
      .collection("users")
      .doc(uid)
      .collection("voices")
      .limit(1)
      .get();

    if (!existing.empty) {
      await lockRef.set(
        { status: "aborted_quota", finishedAt: new Date() },
        { merge: true }
      );
      return NextResponse.json(
        {
          ok: false,
          error: "voice_quota_exceeded",
          message: "Has alcanzado el límite de 1 voz por cuenta.",
        },
        { status: 403 }
      );
    }

    // 4) Body (paths + nombre)
    const body = await req.json().catch(() => ({} as any));
    const paths: string[] = Array.isArray(body?.paths) ? body.paths : [];
    const voiceName: string = (body?.voiceName || "Nueva voz").trim();

    if (paths.length === 0) {
      await lockRef.set(
        { status: "failed", error: "Sin samples", finishedAt: new Date() },
        { merge: true }
      );
      return NextResponse.json(
        { error: "Debes enviar al menos un sample en paths[]" },
        { status: 422 }
      );
    }

    // Seguridad básica: solo permitir rutas del propio usuario
    const invalid = paths.find(
      (p) => !p.replace(/^\/+/, "").startsWith(`users/${uid}/voices/`)
    );
    if (invalid) {
      await lockRef.set(
        { status: "failed", error: "Ruta inválida", finishedAt: new Date() },
        { merge: true }
      );
      return NextResponse.json(
        { error: "Ruta de sample inválida para este usuario." },
        { status: 400 }
      );
    }

    const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);

    // 5) Construir multipart/form-data para ElevenLabs
    const form = new FormData();
    form.set("name", voiceName);

    for (const p of paths) {
      const safePath = p.startsWith("/") ? p.slice(1) : p;
      const gcsFile = bucket.file(safePath);
      const [exists] = await gcsFile.exists();
      if (!exists) {
        await lockRef.set(
          { status: "failed", error: `No existe ${p}`, finishedAt: new Date() },
          { merge: true }
        );
        return NextResponse.json(
          { error: `No existe en Storage: ${p}` },
          { status: 422 }
        );
      }

      let contentType = "application/octet-stream";
      try {
        const [meta] = await gcsFile.getMetadata();
        if (meta?.contentType) contentType = meta.contentType;
      } catch {}

      if (!contentType.startsWith("audio/")) {
        await lockRef.set(
          {
            status: "failed",
            error: `Archivo no audio (${contentType})`,
            finishedAt: new Date(),
          },
          { merge: true }
        );
        return NextResponse.json(
          {
            error: `El archivo ${p} no es audio soportado (${contentType}).`,
          },
          { status: 422 }
        );
      }

      const [buf] = await gcsFile.download();
      const filename = filenameFromPath(p, contentType);
      const file = new FormDataFile([buf], filename, { type: contentType });
      form.append("files", file, filename);
    }

    const encoder = new FormDataEncoder(form);

    // 6) Crear voz en ElevenLabs
    const elRes = await fetch(ELEVEN_ADD_VOICE_URL, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        ...encoder.headers,
      },
      body: Readable.from(encoder) as any,
      duplex: "half",
    } as any);

    const text = await elRes.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* respuesta no JSON */
    }

    if (!elRes.ok) {
      const detail =
        data?.detail?.message ||
        data?.detail ||
        data?.message ||
        data?.error ||
        text ||
        `ElevenLabs devolvió ${elRes.status}`;

      await lockRef.set(
        { status: "failed", error: detail, finishedAt: new Date() },
        { merge: true }
      );
      return NextResponse.json({ error: detail }, { status: elRes.status });
    }

    const payload = {
      voice_id: data?.voice_id || data?.voice?.voice_id || data?.id,
      requires_verification:
        data?.requires_verification ??
        data?.voice?.requires_verification ??
        false,
    };

    await lockRef.set(
      { status: "completed", voiceId: payload.voice_id, finishedAt: new Date() },
      { merge: true }
    );

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    // best-effort: marcar lock como failed
    try {
      const authHeader = req.headers.get("authorization") || "";
      if (authHeader.startsWith("Bearer ")) {
        const idToken = authHeader.split(" ")[1];
        const { uid } = await adminAuth.verifyIdToken(idToken);
        const idem = req.headers.get("x-idempotency-key") || "";
        if (idem) {
          await admin
            .firestore()
            .collection("users")
            .doc(uid)
            .collection("idempotency")
            .doc(`voice_create_${idem}`)
            .set(
              {
                status: "failed",
                error: String(err?.message || err),
                finishedAt: new Date(),
              },
              { merge: true }
            );
        }
      }
    } catch {}

    console.error("[voices/create] error:", err);
    return NextResponse.json(
      { error: err?.message || "Error interno" },
      { status: 500 }
    );
  }
}
