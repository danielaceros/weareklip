import { NextResponse } from "next/server";
import { adminDB, adminAuth } from "@/lib/firebase-admin";
import { randomUUID } from "crypto";

async function verify(req: Request, uidParam: string) {
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.uid !== uidParam) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return null;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}

export async function PUT(req: Request, ctx: any) {
  const { uid, lipsyncId } = ctx?.params || {};
  const authError = await verify(req, uid);
  if (authError) return authError;

  const docRef = adminDB.doc(`users/${uid}/lipsync/${lipsyncId}`);
  const snap = await docRef.get();
  if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = snap.get("uid_share") as string | undefined;
  const shareId = existing || randomUUID();

  await Promise.all([
    docRef.set({ public: true, uid_share: shareId }, { merge: true }),
    adminDB.doc(`shares/${shareId}`).set(
      {
        kind: "lipsync",
        path: `users/${uid}/lipsync/${lipsyncId}`,
        public: true,
        updatedAt: new Date(),
      },
      { merge: true }
    ),
  ]);

  return NextResponse.json({ uid_share: shareId });
}

export async function DELETE(req: Request, ctx: any) {
  const { uid, lipsyncId } = ctx?.params || {};
  const authError = await verify(req, uid);
  if (authError) return authError;

  const docRef = adminDB.doc(`users/${uid}/lipsync/${lipsyncId}`);
  const snap = await docRef.get();
  if (!snap.exists) return NextResponse.json({ ok: true });

  const shareId = snap.get("uid_share") as string | undefined;

  await docRef.set({ public: false }, { merge: true });
  if (shareId) {
    await adminDB.doc(`shares/${shareId}`).delete().catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
