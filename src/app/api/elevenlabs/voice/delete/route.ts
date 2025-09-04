// /app/api/elevenlabs/voice/delete/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { voiceId } = body;

    if (!voiceId || typeof voiceId !== "string") {
      return NextResponse.json({ error: "voiceId requerido" }, { status: 400 });
    }

    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: "DELETE",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "",
      },
    });

    // ElevenLabs DELETE puede devolver JSON o vacío → intentamos parsear seguro
    let data: any = null;
    try {
      const text = await elevenRes.text();
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!elevenRes.ok) {
      console.error("❌ Error ElevenLabs:", data || elevenRes.statusText);
      return NextResponse.json(
        data || { error: elevenRes.statusText },
        { status: elevenRes.status }
      );
    }

    return NextResponse.json({ status: "ok", data }, { status: 200 });
  } catch (err) {
    console.error("❌ Error eliminando voz en ElevenLabs:", err);
    return NextResponse.json(
      { error: "Error eliminando voz en ElevenLabs" },
      { status: 500 }
    );
  }
}
