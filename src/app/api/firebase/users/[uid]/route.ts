// src/app/api/firebase/users/[uid]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";
import admin from "firebase-admin";

// ✅ helper inline para validar token
async function verifyAuth(req: NextRequest, expectedUid?: string) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.split(" ")[1];
  const decoded = await adminAuth.verifyIdToken(token);

  if (expectedUid && decoded.uid !== expectedUid) {
    throw new Error("Forbidden");
  }

  return decoded;
}

// 🔹 Obtener un usuario por UID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    await verifyAuth(req, uid); // ✅ seguridad

    const doc = await adminDB.collection("users").doc(uid).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (err: any) {
    console.error("GET user error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Actualizar un usuario por UID
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    await verifyAuth(req, uid);

    const body = await req.json();

    await adminDB.collection("users").doc(uid).update({
      ...body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: uid, ...body });
  } catch (err: any) {
    console.error("PUT user error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Eliminar un usuario por UID
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    await verifyAuth(req, uid);

    await adminDB.collection("users").doc(uid).delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE user error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
