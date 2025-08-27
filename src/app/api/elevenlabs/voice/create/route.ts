// src/app/api/voices/create/route.ts
import { getStorage } from "firebase-admin/storage";
import { initAdmin, adminAuth } from "@/lib/firebase-admin";
import { FormData, File } from "formdata-node";
import { gaServerEvent } from "@/lib/ga-server";
import { sendEventPush } from "@/lib/sendEventPush";

initAdmin();

export async function POST(req: Request) {
  try {
    // 🔑 Auth opcional (si hay token, lo usamos para notis)
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
      // 🔔 GA4
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

      // ✅ Notificación in-app: nueva voz creada
      if (uid) {
        try {
          await sendEventPush(uid, "voice_created", {
            voiceId: data?.voice_id ?? undefined,
            voiceName,
          });
        } catch {}
      }
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

      // ❗ Notificación de error
      if (uid) {
        try {
          await sendEventPush(uid, "voice_error", {
            voiceName,
            status: elevenResp.status,
            error: data?.error || "Unknown error",
          });
        } catch {}
      }
    }

    return Response.json(data, { status: elevenResp.status });
  } catch (err: any) {
    console.error("❌ Error creando voz:", err);

    await gaServerEvent("voice_failed", {
      error: err?.message || String(err),
      stage: "internal",
    });

    // ❗ Notificación de error (si hay uid)
    try {
      const authHeader = req.headers.get("Authorization") || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const decoded = await adminAuth.verifyIdToken(token).catch(() => null);
        const uid = decoded?.uid;
        if (uid) {
          await sendEventPush(uid, "voice_error", { error: err?.message || String(err) });
        }
      }
    } catch {}

    return Response.json({ error: "Error creando voz en ElevenLabs" }, { status: 500 });
  }
}
