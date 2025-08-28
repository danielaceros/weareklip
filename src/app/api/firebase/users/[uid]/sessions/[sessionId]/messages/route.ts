// app/api/firebase/users/[uid]/sessions/[sessionId]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";

// 🔹 Verificar token y que coincida con el uid del path
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

// 🔹 Listar mensajes de la sesión
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ uid: string; sessionId: string }> }
) {
  try {
    const { uid, sessionId } = await context.params;
    await verifyAuth(req, uid);

    const snap = await adminDB
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .get();

    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("GET messages error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Crear un nuevo mensaje
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ uid: string; sessionId: string }> }
) {
  try {
    const { uid, sessionId } = await context.params;
    await verifyAuth(req, uid);

    const body = await req.json();
    const ref = await adminDB
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .collection("messages")
      .add({
        ...body,
        createdAt: new Date(),
      });

    return NextResponse.json({ id: ref.id, ...body });
  } catch (err: any) {
    console.error("POST message error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
