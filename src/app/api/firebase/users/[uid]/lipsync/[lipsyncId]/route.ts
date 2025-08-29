// src/app/api/firebase/users/[uid]/lipsync/[lipsyncId]/route.ts
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

// 🔹 Obtener lipsync por ID
export async function GET(req: NextRequest, context: any) {
  try {
    const { uid, lipsyncId } = context.params;
    await verifyAuth(req, uid);

    const docSnap = await adminDB
      .collection("users")
      .doc(uid)
      .collection("lipsync")
      .doc(lipsyncId)
      .get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
  } catch (err: any) {
    console.error("GET lipsync error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Crear o actualizar lipsync
export async function PUT(req: NextRequest, context: any) {
  try {
    const { uid, lipsyncId } = context.params;
    await verifyAuth(req, uid);

    const body = await req.json();

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("lipsync")
      .doc(lipsyncId)
      .set(
        {
          ...body,
          updatedAt: new Date(),
        },
        { merge: true }
      );

    return NextResponse.json({ id: lipsyncId, ...body });
  } catch (err: any) {
    console.error("PUT lipsync error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Eliminar lipsync
export async function DELETE(req: NextRequest, context: any) {
  try {
    const { uid, lipsyncId } = context.params;
    await verifyAuth(req, uid);

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("lipsync")
      .doc(lipsyncId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE lipsync error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
