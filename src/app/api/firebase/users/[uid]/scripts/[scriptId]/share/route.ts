import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminAuth, adminFieldValue } from "@/lib/firebase-admin";
import { randomUUID } from "crypto";

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
  { params }: { params: { uid: string; scriptId: string } }
) {
  const forbidden = await verify(req, params.uid);
  if (forbidden) return forbidden;

  const { uid, scriptId } = params;
  const scriptRef = adminDB.doc(`users/${uid}/scripts/${scriptId}`);
  const snap = await scriptRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Generar o reutilizar uid_share
  const existing = snap.get("uid_share") as string | undefined;
  const shareId = existing || randomUUID();

  // 1) marcar el doc original como público
  await scriptRef.set(
    {
      public: true,
      uid_share: shareId,
      updatedAt: adminFieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // 2) upsert en el mapa global
  const shareRef = adminDB.doc(`shares/${shareId}`);
  await shareRef.set(
    {
      kind: "script", // (usaremos "video" cuando dupliquemos el feature)
      uid,
      docId: scriptId,
      path: `users/${uid}/scripts/${scriptId}`,
      public: true,
      createdAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ uid_share: shareId });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { uid: string; scriptId: string } }
) {
  const forbidden = await verify(req, params.uid);
  if (forbidden) return forbidden;

  const { uid, scriptId } = params;
  const scriptRef = adminDB.doc(`users/${uid}/scripts/${scriptId}`);
  const snap = await scriptRef.get();
  if (!snap.exists) return NextResponse.json({ ok: true }); // idempotente

  const shareId = snap.get("uid_share") as string | undefined;

  // 1) marcar el doc original como NO público
  await scriptRef.set(
    {
      public: false,
      updatedAt: adminFieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // 2) mantener el doc de share pero desactivado (mejor UX para reactivar)
  if (shareId) {
    const shareRef = adminDB.doc(`shares/${shareId}`);
    await shareRef.set(
      { public: false, updatedAt: adminFieldValue.serverTimestamp() },
      { merge: true }
    );
  }

  return NextResponse.json({ ok: true });
}
