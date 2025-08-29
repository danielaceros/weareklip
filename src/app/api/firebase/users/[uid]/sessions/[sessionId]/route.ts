// app/api/firebase/users/[uid]/sessions/[sessionId]/route.ts
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

// 🔹 Obtener sesión individual
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ uid: string; sessionId: string }> }
) {
  try {
    const { uid, sessionId } = await context.params;
    await verifyAuth(req, uid);

    const doc = await adminDB
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (err: any) {
    console.error("GET session error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Actualizar sesión individual
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ uid: string; sessionId: string }> }
) {
  try {
    const { uid, sessionId } = await context.params;
    await verifyAuth(req, uid);

    const body = await req.json();
    await adminDB
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .update({
        ...body,
        updatedAt: new Date(),
      });

    return NextResponse.json({ id: sessionId, ...body });
  } catch (err: any) {
    console.error("PUT session error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Eliminar sesión individual
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ uid: string; sessionId: string }> }
) {
  try {
    const { uid, sessionId } = await context.params;
    await verifyAuth(req, uid);

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE session error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
