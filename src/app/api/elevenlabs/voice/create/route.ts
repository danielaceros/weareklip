// app/api/voices/create/route.ts
import { getStorage } from "firebase-admin/storage";
import { initAdmin, adminAuth } from "@/lib/firebase-admin";
import { FormData, File } from "formdata-node";
import { gaServerEvent } from "@/lib/ga-server";

initAdmin();

export async function POST(req: Request) {
  try {
    // 🔑 Autenticación mínima (opcional, si quieres que solo usuarios logueados puedan crear voces)
    const authHeader = req.headers.get("Authorization") || "";
    let uid: string | null = null;
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = await adminAuth.verifyIdToken(token).catch(() => null);
      uid = decoded?.uid || null;
    }

    const { paths, voiceName } = await req.json();
    if (!paths?.length) {
      return Response.json({ error: "No se han enviado rutas de muestras" }, { status: 400 });
    }

    const storage = getStorage();
    const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET);

    const formData = new FormData();
    formData.append("name", voiceName);

    for (let i = 0; i < paths.length; i++) {
      const [fileBuffer] = await bucket.file(paths[i]).download();
      const file = new File([fileBuffer], `sample-${i}.mp3`, { type: "audio/mpeg" });
      formData.append("files", file);
    }

    const elevenResp = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      },
      body: formData as unknown as BodyInit,
    });

    const data = await elevenResp.json();

    if (elevenResp.ok) {
      // 🔔 GA4: evento de éxito
      await gaServerEvent(
        "voice_created",
        {
          voiceName,
          pathsCount: paths.length,
          provider: "elevenlabs",
          voiceId: data?.voice_id || null,
        },
        uid ? { userId: uid } : undefined
      );
    } else {
      // 🔔 GA4: fallo en ElevenLabs
      await gaServerEvent(
        "voice_failed",
        {
          voiceName,
          error: data?.error || "Unknown error",
          status: elevenResp.status,
        },
        uid ? { userId: uid } : undefined
      );
    }

    return Response.json(data, { status: elevenResp.status });
  } catch (err: any) {
    console.error("❌ Error creando voz:", err);

    // 🔔 GA4: error interno
    await gaServerEvent("voice_failed", {
      error: err?.message || String(err),
      stage: "internal",
    });

    return Response.json({ error: "Error creando voz en ElevenLabs" }, { status: 500 });
  }
}
