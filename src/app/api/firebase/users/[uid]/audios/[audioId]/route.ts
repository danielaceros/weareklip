// src/app/api/firebase/users/[uid]/audios/[audioId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";
import admin from "firebase-admin";

// 🔹 Helper local para verificar token
async function verifyAuth(req: NextRequest, expectedUid: string) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.split(" ")[1];
  const decoded = await adminAuth.verifyIdToken(token);

  if (decoded.uid !== expectedUid) {
    throw new Error("Forbidden");
  }

  return decoded;
}

// 🔹 Obtener un audio
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; audioId: string }> }
) {
  try {
    const { uid, audioId } = await params;
    await verifyAuth(req, uid);

    const doc = await adminDB
      .collection("users")
      .doc(uid)
      .collection("audios")
      .doc(audioId)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (err: any) {
    console.error("GET audio error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Actualizar un audio
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; audioId: string }> }
) {
  try {
    const { uid, audioId } = await params;
    await verifyAuth(req, uid);

    const body = await req.json();
    await adminDB
      .collection("users")
      .doc(uid)
      .collection("audios")
      .doc(audioId)
      .update({
        ...body,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ id: audioId, ...body });
  } catch (err: any) {
    console.error("PUT audio error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Eliminar un audio
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; audioId: string }> }
) {
  try {
    const { uid, audioId } = await params;
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
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
