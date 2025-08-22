// src/app/api/elevenlabs/voice/create/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminStorage } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Bucket por defecto (limpio) */
const DEFAULT_BUCKET = (
  process.env.FIREBASE_STORAGE_BUCKET ||
  `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
)
  .trim()
  .replace(/\.firebasestorage\.app$/i, ".appspot.com");

const defaultBucket = adminStorage.bucket(DEFAULT_BUCKET);

/* Aceptamos cualquier formato de entrada y devolvemos { bucket?, object } */
function parseStorageRef(input: string): { bucket?: string; object: string } {
  const s = (input || "").trim();
  if (!s) return { object: "" };

  // gs://bucket/object
  const gs = s.match(/^gs:\/\/([^/]+)\/(.+)$/i);
  if (gs) return { bucket: gs[1], object: gs[2] };

  // https://.../v0/b/<bucket>/o/<object>?...
  const dl = s.match(/\/v0\/b\/([^/]+)\/o\/([^?]+)/i);
  if (dl) return { bucket: dl[1], object: decodeURIComponent(dl[2]) };

  // /o/<object>?...
  const short = s.match(/\/o\/([^?]+)/i);
  if (short) return { object: decodeURIComponent(short[1]) };

  // ruta “plana” de Storage
  return { object: s };
}

type Body = {
  paths: string[];       // puede ser gs://..., downloadURL o ruta "users/.../file.m4a"
  voiceName?: string;
};

export async function POST(req: Request) {
  try {
    // 1) Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    const { uid } = await adminAuth.verifyIdToken(idToken);
    void uid;

    // 2) Body
    const { paths, voiceName } = (await req.json()) as Body;
    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ error: "paths[] requerido" }, { status: 400 });
    }

    // 3) Construimos el multipart con las muestras desde Storage
    const form = new FormData();

    for (let i = 0; i < paths.length; i++) {
      const parsed = parseStorageRef(String(paths[i] ?? ""));
      if (!parsed.object) {
        return NextResponse.json(
          { error: "Ruta vacía/incorrecta en paths", item: paths[i] },
          { status: 400 }
        );
      }

      // bucket por archivo si venía en la URL; si no, usamos el default
      const bucket =
        parsed.bucket && parsed.bucket.trim()
          ? adminStorage.bucket(
              parsed.bucket.trim().replace(/\.firebasestorage\.app$/i, ".appspot.com")
            )
          : defaultBucket;

      const fileRef = bucket.file(parsed.object);

      // Comprobación explícita para errores 404 con detalle
      const [exists] = await fileRef.exists();
      if (!exists) {
        return NextResponse.json(
          {
            error: "Objeto no existe en Storage",
            bucket: bucket.name,
            object: parsed.object,
            hint:
              "Abre Firebase Console > Storage y comprueba que la ruta coincide exactamente.",
          },
          { status: 404 }
        );
      }

      const [buf] = await fileRef.download();

      // Intentamos obtener un mimetype decente (si no, binario)
      let type = "application/octet-stream";
      try {
        const [meta] = await fileRef.getMetadata();
        if (meta?.contentType) type = String(meta.contentType);
      } catch {
        /* ignore meta errors */
      }

      const filename =
        parsed.object.split("/").pop() || `sample-${i}.webm`;

      const blob = new Blob([new Uint8Array(buf)], { type });
      form.append("files", blob, filename);
    }

    // 4) ElevenLabs
    const XI_KEY = (process.env.ELEVENLABS_API_KEY || "").trim();
    if (!XI_KEY) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY no configurada" },
        { status: 500 }
      );
    }

    form.append("name", voiceName || `Voz-${Date.now()}`);

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": XI_KEY },
      body: form,
    });

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = { error: await res.text().catch(() => "Respuesta no JSON") };
    }

    if (!res.ok) {
      console.error("ElevenLabs /voices/add error:", data);
      return NextResponse.json(
        { error: "Error creando voz en ElevenLabs", details: data },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error("Error en /api/elevenlabs/voice/create:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
