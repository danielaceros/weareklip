// app/api/elevenlabs/voice/get/route.ts
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const voiceId = searchParams.get("voiceId");

    if (!voiceId) {
      return Response.json({ error: "Falta el parámetro voiceId" }, { status: 400 });
    }

    const elevenResp = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: "GET",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      },
    });

    const data = await elevenResp.json();
    return Response.json(data, { status: elevenResp.status });
  } catch (error) {
    console.error("Error obteniendo voz:", error);
    return Response.json({ error: "Error al obtener la voz" }, { status: 500 });
  }
}
