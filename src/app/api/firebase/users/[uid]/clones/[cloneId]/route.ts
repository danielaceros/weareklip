// src/app/api/firebase/users/[uid]/clones/[cloneId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";

// 🔹 Verificar token y UID
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

// 🔹 Obtener un clone
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; cloneId: string }> }
) {
  try {
    const { uid, cloneId } = await params;
    await verifyAuth(req, uid);

    const doc = await adminDB
      .collection("users")
      .doc(uid)
      .collection("clones")
      .doc(cloneId)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (err: any) {
    console.error("GET clone error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Actualizar un clone
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; cloneId: string }> }
) {
  try {
    const { uid, cloneId } = await params;
    await verifyAuth(req, uid);

    const body = await req.json();
    await adminDB
      .collection("users")
      .doc(uid)
      .collection("clones")
      .doc(cloneId)
      .update({
        ...body,
        updatedAt: Date.now(),
      });

    return NextResponse.json({ id: cloneId, ...body });
  } catch (err: any) {
    console.error("PUT clone error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Eliminar un clone
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; cloneId: string }> }
) {
  try {
    const { uid, cloneId } = await params;
    await verifyAuth(req, uid);

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("clones")
      .doc(cloneId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE clone error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
