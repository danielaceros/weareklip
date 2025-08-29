// app/api/firebase/users/[uid]/tasks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";
import admin from "firebase-admin"; // para usar admin.firestore.Timestamp

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

// 🔹 Normalizar timestamp a ISO string (o null si no existe)
function serializeTimestamp(ts: any): string | null {
  if (!ts) return null;

  if (ts.toDate) {
    return ts.toDate().toISOString();
  }

  if (typeof ts._seconds === "number") {
    return new Date(
      ts._seconds * 1000 + Math.floor((ts._nanoseconds || 0) / 1e6)
    ).toISOString();
  }

  if (typeof ts === "string" || typeof ts === "number") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

// 🔹 Listar tasks de un usuario
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await context.params;
    await verifyAuth(req, uid);

    const snap = await adminDB
      .collection("users")
      .doc(uid)
      .collection("tasks")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const data = snap.docs.map((d) => {
      const docData = d.data();
      return {
        id: d.id,
        ...docData,
        createdAt: serializeTimestamp(docData.createdAt),
        updatedAt: serializeTimestamp(docData.updatedAt),
      };
    });

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("GET tasks error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Crear nueva task
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await context.params;
    await verifyAuth(req, uid);

    const body = await req.json();
    const now = admin.firestore.Timestamp.now();

    const ref = await adminDB
      .collection("users")
      .doc(uid)
      .collection("tasks")
      .add({
        ...body,
        createdAt: now,
        updatedAt: now,
      });

    return NextResponse.json({
      id: ref.id,
      ...body,
      createdAt: now.toDate().toISOString(),
      updatedAt: now.toDate().toISOString(),
    });
  } catch (err: any) {
    console.error("POST tasks error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
