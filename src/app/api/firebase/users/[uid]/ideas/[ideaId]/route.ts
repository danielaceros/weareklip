// src/app/api/firebase/users/[uid]/ideas/[ideaId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";

// 🔹 Verificar token y UID
async function verifyAuth(req: NextRequest, expectedUid: string) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const token = authHeader.split(" ")[1];
  const decoded = await adminAuth.verifyIdToken(token);

  if (decoded.uid !== expectedUid) throw new Error("Forbidden");
  return decoded;
}

// 🔹 Obtener idea por ID
export async function GET(req: NextRequest, context: any) {
  try {
    const { uid, ideaId } = context.params;
    await verifyAuth(req, uid);

    const docSnap = await adminDB
      .collection("users")
      .doc(uid)
      .collection("ideas")
      .doc(ideaId)
      .get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
  } catch (err: any) {
    console.error("GET idea error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Crear o actualizar idea por ID
export async function PUT(req: NextRequest, context: any) {
  try {
    const { uid, ideaId } = context.params;
    await verifyAuth(req, uid);

    const body = await req.json();

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("ideas")
      .doc(ideaId)
      .set(
        {
          ...body,
          updatedAt: new Date(),
        },
        { merge: true }
      );

    return NextResponse.json({ id: ideaId, ...body });
  } catch (err: any) {
    console.error("PUT idea error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Eliminar idea por ID
export async function DELETE(req: NextRequest, context: any) {
  try {
    const { uid, ideaId } = context.params;
    await verifyAuth(req, uid);

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("ideas")
      .doc(ideaId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE idea error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
