// src/app/api/stripe/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminAuth, adminDB } from "@/lib/firebase-admin";
import Stripe from "stripe";

type Plan = "starter" | "mid" | "creator" | "business";

const PRICE_BY_PLAN: Record<Plan, string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  mid: process.env.STRIPE_PRICE_MID!,
  creator: process.env.STRIPE_PRICE_CREATOR!,
  business: process.env.STRIPE_PRICE_BUSINESS!,
};

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3000";

type Body = Partial<{ plan: Plan; idToken: string }>;

function isStripeError(x: unknown): x is { type?: string; code?: string; message?: string } {
  return typeof x === "object" && x !== null;
}

function isDeletedCustomer(
  c: Stripe.Customer | Stripe.DeletedCustomer
): c is Stripe.DeletedCustomer {
  return "deleted" in c && (c as Stripe.DeletedCustomer).deleted === true;
}

async function safeRetrieveCustomer(id: string): Promise<Stripe.Customer | null> {
  try {
    const c = await stripe.customers.retrieve(id);
    if (isDeletedCustomer(c)) return null;
    return c as Stripe.Customer;
  } catch (e: unknown) {
    if (isStripeError(e) && (e.type === "StripeInvalidRequestError" || e.code === "resource_missing")) {
      return null;
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1) Auth (Bearer o body.idToken)
    const authHeader = req.headers.get("authorization");
    const hasBearer = authHeader?.startsWith("Bearer ");
    let body: Body = {};
    try {
      body = await req.json();
    } catch {
      // vacío
    }

    const idToken =
      hasBearer
        ? authHeader!.split(" ")[1]
        : (typeof body.idToken === "string" ? body.idToken : undefined);

    if (!idToken) {
      return NextResponse.json({ error: "Missing ID token" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // 2) Validar plan
    const plan = body.plan;
    if (!plan || !(plan in PRICE_BY_PLAN)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    const priceId = PRICE_BY_PLAN[plan];

    // 3) Resolver customerId desde Firestore
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    const savedId = (snap.data()?.stripeCustomerId as string | undefined) ?? undefined;

    let customerId: string | undefined;

    if (savedId) {
      const c = await safeRetrieveCustomer(savedId);
      if (c) customerId = c.id;
    }

    // Si no existe → crear customer nuevo con metadata.uid
    if (!customerId) {
      const created = await stripe.customers.create({
        metadata: { uid },
      });
      customerId = created.id;
    }

    // Guardar/actualizar en Firestore
    await userRef.set({ stripeCustomerId: customerId }, { merge: true });

    // 4) Crear Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { uid, plan },
      subscription_data: { metadata: { uid, plan } },
      success_url: `${APP_URL}/dashboard?success=1`,
      cancel_url: `${APP_URL}/dashboard?cancel=1`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: unknown) {
    const msg =
      isStripeError(e) && typeof e.message === "string"
        ? e.message
        : "Internal error creating checkout session";
    console.error("❌ /api/stripe/checkout error:", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
