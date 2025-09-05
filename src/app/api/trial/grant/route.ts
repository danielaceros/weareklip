// src/app/api/trial/grant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { gaServerEvent } from "@/lib/ga-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TRIAL_CENTS = Number(process.env.TRIAL_CREDIT_CENTS ?? "500");

export async function POST(req: NextRequest) {
  try {
    // 1) Auth
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;

    if (!idToken) {
      return NextResponse.json({ error: "Missing ID token" }, { status: 401 });
    }

    const { uid, email } = await adminAuth.verifyIdToken(idToken);

    // 2) User doc
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado en Firestore" },
        { status: 404 }
      );
    }

    const user = snap.data() as {
      stripeCustomerId?: string;
      isGiftUsed?: boolean;
    } | undefined;
    const customerId: string | undefined = user?.stripeCustomerId;

    if (!customerId) {
      return NextResponse.json(
        { error: "Usuario sin customerId en Stripe" },
        { status: 400 }
      );
    }

    if (user?.isGiftUsed) {
      return NextResponse.json(
        { error: "El usuario ya consumió el crédito promocional" },
        { status: 400 }
      );
    }

    // 3) Verificar que el customer no tenga trial_credit_granted
    const customer = (await stripe.customers.retrieve(
      customerId
    )) as Stripe.Customer;
    if (customer.metadata?.trial_credit_granted === "1") {
      return NextResponse.json(
        { error: "Ya existe un crédito promocional otorgado en Stripe" },
        { status: 400 }
      );
    }

    // 4) Buscar trial_end en la suscripción activa
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "trialing",
      limit: 1,
    });

    const trialEnd = subs.data[0]?.trial_end; // epoch seconds
    if (!trialEnd) {
      return NextResponse.json(
        { error: "El cliente no tiene un periodo de prueba activo" },
        { status: 400 }
      );
    }

    // 5) Crear credit grant con expiración
    const grant = await stripe.billing.creditGrants.create({
      customer: customerId,
      name: "Gift Credits",
      category: "promotional",
      amount: {
        type: "monetary",
        monetary: { currency: "eur", value: DEFAULT_TRIAL_CENTS },
      },
      applicability_config: {
        scope: { price_type: "metered" },
      },
      expires_at: trialEnd,
    } as any);

    // 6) Guardar flags
    await Promise.all([
      userRef.set({ isGiftUsed: true }, { merge: true }),
      stripe.customers.update(customerId, {
        metadata: {
          trial_credit_granted: "1",
          trial_credit_grant_id: grant.id,
          trial_credit_expires_at: String(trialEnd),
        },
      }),
    ]);

    await gaServerEvent("gift_credit_granted", {
      uid,
      email,
      customerId,
      grantId: grant.id,
      trialEnd,
    });

    return NextResponse.json({ ok: true, grantId: grant.id, trialEnd });
  } catch (e: any) {
    console.error("❌ /api/trial/grant error:", e);
    return NextResponse.json(
      { error: e.message ?? "trial_grant_error" },
      { status: 500 }
    );
  }
}
