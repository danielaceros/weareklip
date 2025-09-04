// /app/api/firebase/users/[uid]/voices/[voiceId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";

// 🔹 Verificar token y ownership
async function verifyAuth(req: NextRequest, expectedUid: string) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const token = authHeader.split(" ")[1];
  const decoded = await adminAuth.verifyIdToken(token);

  if (decoded.uid !== expectedUid) throw new Error("Forbidden");
  return decoded;
}

// Tipado de params
interface RouteContext {
  params: Promise<{ uid: string; voiceId: string }>;
}

// 🔹 GET una voz
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { uid, voiceId } = await context.params; // 👈 await obligatorio
    await verifyAuth(req, uid);

    const docSnap = await adminDB
      .collection("users")
      .doc(uid)
      .collection("voices")
      .doc(voiceId)
      .get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
  } catch (err: any) {
    console.error("GET voice error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 PUT crear o actualizar voz
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { uid, voiceId } = await context.params; // 👈 await obligatorio
    await verifyAuth(req, uid);

    const body = await req.json();

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("voices")
      .doc(voiceId)
      .set(
        {
          ...body,
          updatedAt: new Date(),
        },
        { merge: true }
      );

    return NextResponse.json({ id: voiceId, ...body });
  } catch (err: any) {
    console.error("PUT voice error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 DELETE eliminar voz
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { uid, voiceId } = await context.params; // 👈 await obligatorio
    await verifyAuth(req, uid);

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("voices")
      .doc(voiceId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE voice error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
