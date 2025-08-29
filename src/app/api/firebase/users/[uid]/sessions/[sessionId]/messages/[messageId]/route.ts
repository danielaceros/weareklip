// app/api/firebase/users/[uid]/sessions/[sessionId]/messages/[messageId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";

// 🔹 Verificar token contra el uid del path
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

// 🔹 Obtener mensaje individual
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ uid: string; sessionId: string; messageId: string }> }
) {
  try {
    const { uid, sessionId, messageId } = await context.params;
    await verifyAuth(req, uid);

    const doc = await adminDB
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .collection("messages")
      .doc(messageId)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (err: any) {
    console.error("GET message error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Actualizar mensaje individual
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ uid: string; sessionId: string; messageId: string }> }
) {
  try {
    const { uid, sessionId, messageId } = await context.params;
    await verifyAuth(req, uid);

    const body = await req.json();

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .collection("messages")
      .doc(messageId)
      .update({
        ...body,
        updatedAt: new Date(),
      });

    return NextResponse.json({ id: messageId, ...body });
  } catch (err: any) {
    console.error("PUT message error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Eliminar mensaje individual
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ uid: string; sessionId: string; messageId: string }> }
) {
  try {
    const { uid, sessionId, messageId } = await context.params;
    await verifyAuth(req, uid);

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .collection("messages")
      .doc(messageId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE message error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
