// src/app/api/auth/post-login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1) Bearer idToken
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const idToken = auth.split(" ")[1];

    // 2) Verificar token con Firebase Admin
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const uid = decoded.uid;
    const email =
      (decoded as any)?.email ||
      (typeof decoded?.email === "string" ? decoded.email : undefined);

    // 3) ¿Ya tenemos stripeCustomerId en Firestore?
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    const existing = snap.exists ? (snap.data() as any) : {};
    if (existing?.stripeCustomerId) {
      return NextResponse.json({ ok: true, customerId: existing.stripeCustomerId });
    }

    // 4) Buscar Customer por metadata.uid o email (para no duplicar)
    let customerId: string | undefined;

    // 4a) por metadata.uid
    try {
      const listByUid = await stripe.customers.search({
        query: `metadata['uid']:'${uid}'`,
        limit: 1,
      });
      if (listByUid.data[0]) customerId = listByUid.data[0].id;
    } catch {}

    // 4b) por email (si no lo encontramos por uid)
    if (!customerId && email) {
      const listByEmail = await stripe.customers.list({ email, limit: 1 });
      if (listByEmail.data[0]) customerId = listByEmail.data[0].id;
    }

    // 5) Crear si sigue sin existir
    if (!customerId) {
      const created = await stripe.customers.create({
        email: email || undefined,
        metadata: { uid },
      });
      customerId = created.id;
    } else {
      // asegurar que metadata.uid está puesto
      await stripe.customers.update(customerId, {
        metadata: { uid },
        ...(email ? { email } : {}),
      });
    }

    // 6) Guardar en Firestore
    await userRef.set(
      { email: email || existing?.email || null, stripeCustomerId: customerId, lastUpdated: new Date() },
      { merge: true }
    );

    // 7) OK
    return NextResponse.json({ ok: true, customerId });
  } catch (e: any) {
    console.error("[post-login] error:", e?.message || e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
