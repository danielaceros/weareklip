import { NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";
import { FormData } from "formdata-node";
import { Blob } from "buffer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ transcript: "" });
  }

  try {
    const audioStream = ytdl(id, { quality: "lowestaudio", filter: "audioonly" });
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk as Buffer);
    }
    const audioBuffer = Buffer.concat(chunks);

    const blob = new Blob([audioBuffer], { type: "audio/mpeg" });

    const form = new FormData();
    form.set("file", blob, `${id}.mp3`);
    form.set("model", "whisper-1");
    form.set("language", "es");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
      },
      body: form as unknown as BodyInit, // ✅ conversión segura
    });

    if (!res.ok) {
      throw new Error(`OpenAI error: ${await res.text()}`);
    }

    const data: { text?: string } = await res.json();
    return NextResponse.json({ transcript: data.text || "" });
  } catch (err: unknown) {
    console.error("Transcript error:", err);
    return NextResponse.json({ transcript: "" });
  }
}
