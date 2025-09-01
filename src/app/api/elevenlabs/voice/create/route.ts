import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { initAdmin, adminAuth } from "@/lib/firebase-admin";
import { FormData, File as FormDataFile } from "formdata-node";
import { FormDataEncoder } from "form-data-encoder";
import { Readable } from "node:stream";

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

// Normaliza bucket de entorno si viene con firebasestorage.app
function normalizeBucket(name?: string | null) {
  if (!name) return undefined;
  return name.includes("firebasestorage.app")
    ? name.replace("firebasestorage.app", "appspot.com")
    : name;
}

async function verifyOptional(req: NextRequest) {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  try {
    const token = h.split(" ")[1];
    const dec = await adminAuth.verifyIdToken(token);
    return dec?.uid ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!ELEVEN_KEY) {
      return NextResponse.json(
        { error: "Falta ELEVENLABS_API_KEY en el entorno" },
        { status: 500 }
      );
    }

    const uid = await verifyOptional(req);

    const body = await req.json().catch(() => ({}));
    const paths: string[] = Array.isArray(body?.paths) ? body.paths : [];
    const voiceName: string = body?.voiceName || "Nueva voz";

    if (paths.length === 0) {
      return NextResponse.json(
        { error: "Debes enviar al menos un sample en paths[]" },
        { status: 422 }
      );
    }

    const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);

    const form = new FormData();
    form.set("name", voiceName);

    for (const p of paths) {
      console.log(bucket)
      console.log("Bucket:", bucket.name, "Path:", p);
      const safePath = p.startsWith("/") ? p.slice(1) : p;
      const gcsFile = bucket.file(safePath);
      const [exists] = await gcsFile.exists();
      if (!exists) {
        return NextResponse.json(
          { error: `No existe en Storage: ${p}` },
          { status: 422 }
        );
      }

      // Intenta leer content-type real
      let contentType = "application/octet-stream";
      try {
        const [meta] = await gcsFile.getMetadata();
        if (meta?.contentType) contentType = meta.contentType;
      } catch {
        /* ignore */
      }

      // Solo audio válido para ElevenLabs
      if (!contentType.startsWith("audio/")) {
        return NextResponse.json(
          {
            error: `El archivo ${p} no es audio soportado (${contentType}). Sube muestras de audio (mp3, m4a, wav...).`,
          },
          { status: 422 }
        );
      }

      const [buf] = await gcsFile.download();

      // 👉 Usamos File de formdata-node (evita el error de Blob en Node)
      const filename = filenameFromPath(p, contentType);
      const file = new FormDataFile([buf], filename, { type: contentType });
      form.append("files", file, filename); // campo repetido "files"
    }

    // Codifica FormData para fetch en Node
    const encoder = new FormDataEncoder(form);

    const elRes = await fetch(ELEVEN_ADD_VOICE_URL, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        ...encoder.headers, // boundary correcto
      },
      body: Readable.from(encoder) as any,
      duplex: "half", // 👈 obligatorio en Node >=18 si el body es un stream
    } as any);

    const text = await elRes.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* respuesta no-JSON, dejamos text */
    }

    if (!elRes.ok) {
      const detail =
        data?.detail?.message ||
        data?.detail ||
        data?.message ||
        data?.error ||
        text ||
        `ElevenLabs devolvió ${elRes.status}`;
      return NextResponse.json({ error: detail }, { status: elRes.status });
    }

    const payload = {
      voice_id: data?.voice_id || data?.voice?.voice_id || data?.id,
      requires_verification:
        data?.requires_verification ??
        data?.voice?.requires_verification ??
        false,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error("[voices/create] error:", err);
    return NextResponse.json(
      { error: err?.message || "Error interno" },
      { status: 500 }
    );
  }
}
