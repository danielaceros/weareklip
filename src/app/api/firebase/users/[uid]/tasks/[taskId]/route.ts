// app/api/firebase/users/[uid]/tasks/[taskId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";

// 🔹 Verificar token y que coincida con uid del path
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

// 🔹 Obtener un task
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ uid: string; taskId: string }> }
) {
  try {
    const { uid, taskId } = await context.params;
    await verifyAuth(req, uid);

    const doc = await adminDB
      .collection("users")
      .doc(uid)
      .collection("tasks")
      .doc(taskId)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const docData = doc.data() || {};
    return NextResponse.json({
      id: doc.id,
      ...docData,
      createdAt: docData.createdAt?.toDate
        ? docData.createdAt.toDate()
        : null,
      updatedAt: docData.updatedAt?.toDate
        ? docData.updatedAt.toDate()
        : null,
    });
  } catch (err: any) {
    console.error("GET task error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Actualizar un task
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ uid: string; taskId: string }> }
) {
  try {
    const { uid, taskId } = await context.params; // ✅ await params
    await verifyAuth(req, uid);

    const body = await req.json();
    await adminDB
      .collection("users")
      .doc(uid)
      .collection("tasks")
      .doc(taskId)
      .update({
        ...body,
        updatedAt: new Date(),
      });

    return NextResponse.json({ id: taskId, ...body });
  } catch (err: any) {
    console.error("PUT task error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Eliminar un task
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ uid: string; taskId: string }> }
) {
  try {
    const { uid, taskId } = await context.params; // ✅ await params
    await verifyAuth(req, uid);

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("tasks")
      .doc(taskId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE task error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
