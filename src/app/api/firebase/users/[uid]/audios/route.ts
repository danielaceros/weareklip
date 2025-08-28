// src/app/api/firebase/users/[uid]/audios/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";
import admin from "firebase-admin";

// 🔹 Validar que el token sea válido y coincida con el UID del path
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

// 🔹 Obtener audios de un usuario
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    await verifyAuth(req, uid); // ✅ seguridad

    const snap = await adminDB
      .collection("users")
      .doc(uid)
      .collection("audios")
      .orderBy("createdAt", "desc")
      .get();

    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("GET audios error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 Crear un audio para un usuario
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    await verifyAuth(req, uid); // ✅ seguridad

    const body = await req.json();
    const ref = await adminDB
      .collection("users")
      .doc(uid)
      .collection("audios")
      .add({
        ...body,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ id: ref.id, ...body });
  } catch (err: any) {
    console.error("POST audios error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
