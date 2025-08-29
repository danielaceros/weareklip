// app/api/firebase/users/[uid]/voices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";

// 🔹 Verificar token y ownership
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

// 🔹 GET voces de un usuario
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
      .collection("voices")
      .orderBy("createdAt", "desc")
      .get();

    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("GET voices error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 POST nueva voz
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await context.params;
    await verifyAuth(req, uid);

    const body = await req.json();
    const ref = await adminDB
      .collection("users")
      .doc(uid)
      .collection("voices")
      .add({
        ...body,
        createdAt: new Date(),
      });

    return NextResponse.json({ id: ref.id, ...body });
  } catch (err: any) {
    console.error("POST voices error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
