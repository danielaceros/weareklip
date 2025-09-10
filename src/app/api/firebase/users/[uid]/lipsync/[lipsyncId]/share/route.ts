import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminDB, adminAuth, adminFieldValue } from "@/lib/firebase-admin";

async function verify(req: NextRequest, uidParam: string) {
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.uid !== uidParam) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { uid: string; lipsyncId: string } }
) {
  const guard = await verify(req, params.uid);
  if (guard) return guard;

  const docRef = adminDB.doc(`users/${params.uid}/lipsync/${params.lipsyncId}`);
  const snap = await docRef.get();
  if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = snap.data() || {};
  const existingShare = data.uid_share as string | undefined;
  const uid_share = existingShare || randomUUID();

  const shareRef = adminDB.doc(`shares/${uid_share}`);

  const batch = adminDB.batch();
  batch.set(docRef, { public: true, uid_share }, { merge: true });
  batch.set(
    shareRef,
    {
      path: `users/${params.uid}/lipsync/${params.lipsyncId}`,
      kind: "lipsync",
      public: true,
      updatedAt: adminFieldValue.serverTimestamp(),
      createdAt: adminFieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();

  return NextResponse.json({ ok: true, uid_share });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { uid: string; lipsyncId: string } }
) {
  const guard = await verify(req, params.uid);
  if (guard) return guard;

  const docRef = adminDB.doc(`users/${params.uid}/lipsync/${params.lipsyncId}`);
  const snap = await docRef.get();
  if (!snap.exists) return NextResponse.json({ ok: true });

  const data = snap.data() || {};
  const uid_share = (data.uid_share as string | undefined) || null;

  const batch = adminDB.batch();
  batch.set(
    docRef,
    { public: false, uid_share: adminFieldValue.delete() },
    { merge: true }
  );
  if (uid_share) batch.delete(adminDB.doc(`shares/${uid_share}`));

  await batch.commit();
  return NextResponse.json({ ok: true });
}
