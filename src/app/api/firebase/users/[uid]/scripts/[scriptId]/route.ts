// app/api/firebase/users/[uid]/scripts/[scriptId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";

// 🔹 Verificación de auth
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

// 🔹 Obtener un script por ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; scriptId: string }> }
) {
  try {
    const { uid, scriptId } = await params;
    await verifyAuth(req, uid);

    const docSnap = await adminDB
      .collection("users")
      .doc(uid)
      .collection("scripts")
      .doc(scriptId)
      .get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
  } catch (err: any) {
    console.error("GET script error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Actualizar un script
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; scriptId: string }> }
) {
  try {
    const { uid, scriptId } = await params;
    await verifyAuth(req, uid);

    const body = await req.json();
    await adminDB
      .collection("users")
      .doc(uid)
      .collection("scripts")
      .doc(scriptId)
      .update({
        ...body,
        updatedAt: new Date(),
      });

    return NextResponse.json({ id: scriptId, ...body });
  } catch (err: any) {
    console.error("PUT script error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Eliminar un script
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; scriptId: string }> }
) {
  try {
    const { uid, scriptId } = await params;
    await verifyAuth(req, uid);

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("scripts")
      .doc(scriptId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE script error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
