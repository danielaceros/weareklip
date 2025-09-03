import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";
import admin from "firebase-admin";

async function verifyAuth(req: NextRequest, expectedUid: string) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const token = authHeader.split(" ")[1];
  const decoded = await adminAuth.verifyIdToken(token);

  if (decoded.uid !== expectedUid) throw new Error("Forbidden");
  return decoded;
}

function safeFileName(name: string) {
  return name
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function extFromContentType(ct?: string | null) {
  if (!ct) return ".mp3";
  const map: Record<string, string> = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
    "audio/aac": ".aac",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
  };
  return map[ct.toLowerCase()] ?? ".mp3";
}

// 🔹 GET
export async function GET(req: NextRequest, context: any) {
  try {
    const { uid, audioId } = context.params;
    await verifyAuth(req, uid);

    const url = new URL(req.url);
    const wantDownload = url.searchParams.get("download") === "1";

    const docSnap = await adminDB
      .collection("users")
      .doc(uid)
      .collection("audios")
      .doc(audioId)
      .get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = docSnap.data() || {};
    const audioUrl: string | undefined = data.audioUrl ?? data.url;
    const name: string =
      safeFileName(String(data.name || "audio")) || `audio-${audioId}`;

    if (!wantDownload) {
      // Comportamiento actual (detalles JSON)
      return NextResponse.json({ id: docSnap.id, ...data });
    }

    if (!audioUrl) {
      return NextResponse.json(
        { error: "Audio URL missing" },
        { status: 400 }
      );
    }

    // Descarga proxy (fuerza Content-Disposition para nombre de archivo)
    const upstream = await fetch(audioUrl, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Upstream error ${upstream.status}` },
        { status: 502 }
      );
    }

    const ct = upstream.headers.get("content-type");
    const filename = `${name}${extFromContentType(ct)}`;

    const headers = new Headers();
    headers.set("Content-Type", ct || "application/octet-stream");
    headers.set(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    headers.set("Cache-Control", "private, max-age=0, must-revalidate");

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error("GET audio error:", err);
    const status =
      err?.message === "Unauthorized"
        ? 401
        : err?.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err?.message || "Server error" }, { status });
  }
}

// 🔹 PUT
export async function PUT(req: NextRequest, context: any) {
  try {
    const { uid, audioId } = context.params;
    await verifyAuth(req, uid);

    const body = await req.json();

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("audios")
      .doc(audioId)
      .set(
        {
          ...body,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ id: audioId, ...body });
  } catch (err: any) {
    console.error("PUT audio error:", err);
    const status =
      err?.message === "Unauthorized"
        ? 401
        : err?.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err?.message || "Server error" }, { status });
  }
}

// 🔹 DELETE
export async function DELETE(req: NextRequest, context: any) {
  try {
    const { uid, audioId } = context.params;
    await verifyAuth(req, uid);

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("audios")
      .doc(audioId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE audio error:", err);
    const status =
      err?.message === "Unauthorized"
        ? 401
        : err?.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err?.message || "Server error" }, { status });
  }
}
