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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; cloneId: string }> }
) {
  try {
    const { uid, cloneId } = await params;
    await verifyAuth(req, uid);

    const snap = await adminDB
      .collection("users").doc(uid)
      .collection("clones").doc(cloneId)
      .get();

    if (!snap.exists) return NextResponse.json({ exists: false }, { status: 200 });
    return NextResponse.json({ id: cloneId, ...snap.data() }, { status: 200 });
  } catch (err: any) {
    const status = err.message === "Unauthorized" ? 401 :
                   err.message === "Forbidden"   ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; cloneId: string }> }
) {
  try {
    const { uid, cloneId } = await params;
    await verifyAuth(req, uid);

    const body = await req.json();
    const ref = adminDB
      .collection("users").doc(uid)
      .collection("clones").doc(cloneId);

    const now = admin.firestore.FieldValue.serverTimestamp();
    await ref.set({ id: cloneId, ...body, updatedAt: now }, { merge: true });

    const fresh = await ref.get();
    return NextResponse.json({ id: cloneId, ...fresh.data() }, { status: 200 });
  } catch (err: any) {
    console.error("PUT clone error:", err);
    const status = err.message === "Unauthorized" ? 401 :
                   err.message === "Forbidden"   ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; cloneId: string }> }
) {
  try {
    const { uid, cloneId } = await params;
    await verifyAuth(req, uid);

    await adminDB
      .collection("users").doc(uid)
      .collection("clones").doc(cloneId)
      .delete();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE clone error:", err);
    const status = err.message === "Unauthorized" ? 401 :
                   err.message === "Forbidden"   ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
