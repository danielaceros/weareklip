import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { adminAuth } from "@/lib/firebase-admin";
import { type ChatCompletionMessageParam } from "openai/resources/chat/completions";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    // 1) Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const uid = decoded.uid;

    // 2) Body
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // 3) Cast seguro para TS
    const safeMessages: ChatCompletionMessageParam[] = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: String(m.content || "").slice(0, 1000),
    }));

    // 4) OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: safeMessages,
      max_tokens: 300,
      temperature: 0.7,
      user: uid,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      "⚠️ No tengo respuesta ahora mismo.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("❌ Chatbot API error:", err);
    return NextResponse.json(
      { error: "Error interno en el chatbot" },
      { status: 500 }
    );
  }
}
