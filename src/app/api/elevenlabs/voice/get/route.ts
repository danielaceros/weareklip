import { gaServerEvent } from "@/lib/ga-server";

export async function GET(req: Request) {
  try {
    // 1) Obtención de parámetros
    const { searchParams } = new URL(req.url);
    const voiceId = searchParams.get("voiceId");

    if (!voiceId) {
      await gaServerEvent("voice_fetch_failed", {
        reason: "missing_voiceId",
      });
      return Response.json({ error: "Falta el parámetro voiceId" }, { status: 400 });
    }

    // 2) Solicitud a ElevenLabs API
    const elevenResp = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: "GET",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      },
    });

    const data = await elevenResp.json();

    // 3) Registro de eventos
    if (elevenResp.ok) {
      await gaServerEvent("voice_fetched", {
        voiceId,
        provider: "elevenlabs",
      });
    } else {
      await gaServerEvent("voice_fetch_failed", {
        voiceId,
        status: elevenResp.status,
        error: data?.error || "Unknown error",
      });
    }

    // 4) Respuesta
    return Response.json(data, { status: elevenResp.status });
  } catch (error: any) {
    console.error("❌ Error obteniendo voz:", error);

    // Evento en caso de error
    await gaServerEvent("voice_fetch_failed", {
      error: error?.message || String(error),
      stage: "internal",
    });

    return Response.json({ error: "Error al obtener la voz" }, { status: 500 });
  }
}
