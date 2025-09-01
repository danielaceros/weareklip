import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";
import admin from "firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyAuth(req: NextRequest, expectedUid?: string) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.split(" ")[1];
  const decoded = await adminAuth.verifyIdToken(token);
  if (expectedUid && decoded.uid !== expectedUid) throw new Error("Forbidden");
  return decoded;
}

/**
 * GET /api/firebase/users/[uid]
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await context.params;
    await verifyAuth(req, uid);

    const snap = await adminDB.collection("users").doc(uid).get();

    if (!snap.exists) {
      return NextResponse.json({ exists: false }, { status: 200 });
    }

    return NextResponse.json({ id: uid, ...snap.data() }, { status: 200 });
  } catch (err: any) {
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * PUT /api/firebase/users/[uid]
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await context.params;
    await verifyAuth(req, uid);

    const body = await req.json();
    const ref = adminDB.collection("users").doc(uid);

    const now = admin.firestore.FieldValue.serverTimestamp();
    await ref.set({ ...body, updatedAt: now }, { merge: true });

    const fresh = await ref.get();
    return NextResponse.json({ id: uid, ...fresh.data() }, { status: 200 });
  } catch (err: any) {
    console.error("PUT user error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * DELETE /api/firebase/users/[uid]
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await context.params;
    await verifyAuth(req, uid);

    await adminDB.collection("users").doc(uid).delete();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE user error:", err);
    const status =
      err.message === "Unauthorized"
        ? 401
        : err.message === "Forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
