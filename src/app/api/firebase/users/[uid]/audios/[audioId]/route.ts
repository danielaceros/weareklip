// src/app/api/firebase/users/[uid]/audios/[audioId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";
import admin from "firebase-admin";

async function verifyAuth(req: NextRequest, expectedUid: string) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const token = authHeader.split(" ")[1];
  const decoded = await adminAuth.verifyIdToken(token);

  if (decoded.uid !== expectedUid) throw new Error("Forbidden");
  return decoded;
}

// 🔹 GET
export async function GET(req: NextRequest, context: any) {
  try {
    const { uid, audioId } = context.params;
    await verifyAuth(req, uid);

    const docSnap = await adminDB
      .collection("users")
      .doc(uid)
      .collection("audios")
      .doc(audioId)
      .get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ id: docSnap.id, ...docSnap.data() });
  } catch (err: any) {
    console.error("GET audio error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 PUT
export async function PUT(req: NextRequest, context: any) {
  try {
    const { uid, audioId } = context.params;
    await verifyAuth(req, uid);

    const body = await req.json();

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("audios")
      .doc(audioId)
      .set(
        {
          ...body,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ id: audioId, ...body });
  } catch (err: any) {
    console.error("PUT audio error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// 🔹 DELETE
export async function DELETE(req: NextRequest, context: any) {
  try {
    const { uid, audioId } = context.params;
    await verifyAuth(req, uid);

    await adminDB
      .collection("users")
      .doc(uid)
      .collection("audios")
      .doc(audioId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE audio error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
