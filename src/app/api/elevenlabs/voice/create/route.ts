// app/api/voices/create/route.ts
import { getStorage } from "firebase-admin/storage";
import { initAdmin } from "@/lib/firebase-admin";
import { FormData, File } from "formdata-node";

initAdmin();

export async function POST(req: Request) {
  try {
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
    return Response.json(data, { status: elevenResp.status });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error creando voz en ElevenLabs" }, { status: 500 });
  }
}
