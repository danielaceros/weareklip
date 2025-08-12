// src/app/api/submagic/create/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const { title, language, videoUrl, templateName, uid, email } = body;

  if (!title || !language || !videoUrl || !uid || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Detectar si es desarrollo o producción
  const baseUrl =
    process.env.NODE_ENV === "development"
      ? process.env.NGROK_URL || "http://localhost:3000"
      : "https://app.weareklip.com";

  const webhookUrl = `${baseUrl}/api/webhook/submagic?uid=${uid}&email=${encodeURIComponent(email)}`;

  console.log("Payload recibido en API /submagic/create:", body);
  console.log("Webhook URL generada:", webhookUrl);

  const r = await fetch("https://api.submagic.co/v1/projects", {
    method: "POST",
    headers: {
      "x-api-key": process.env.SUBMAGIC_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      language,
      videoUrl,
      templateName,
      webhookUrl,
      magicZooms: true,
      magicBrolls: true,
      magicBrollsPercentage: 70,
    }),
  });

  const rawResponse = await r.text();
  console.log("Respuesta cruda de Submagic:", rawResponse);

  let data;
  try {
    data = JSON.parse(rawResponse);
  } catch {
    data = { error: "Invalid JSON response from Submagic", raw: rawResponse };
  }

  return NextResponse.json(data, { status: r.status });
}
