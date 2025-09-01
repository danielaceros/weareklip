import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminAuth, adminDB } from "@/lib/firebase-admin";
import Stripe from "stripe";
import { gaServerEvent } from "@/lib/ga-server";

type Plan = "ACCESS" | "MID" | "CREATOR" | "BUSINESS";

const PRICE_BY_PLAN: Record<Plan, string> = {
  ACCESS: process.env.STRIPE_PRICE_ACCESS!,
  MID: process.env.STRIPE_PRICE_MID!,
  CREATOR: process.env.STRIPE_PRICE_CREATOR!,
  BUSINESS: process.env.STRIPE_PRICE_BUSINESS!,
};

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3000";

type Body = Partial<{ plan: Plan; idToken: string; email: string, next: string }>;

function isStripeError(x: any): x is { type?: string; code?: string; message?: string } {
  return x && typeof x === "object";
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
  } catch (e: any) {
    if (e?.type === "StripeInvalidRequestError" || e?.code === "resource_missing") {
      return null;
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1) Auth
    const authHeader = req.headers.get("authorization");
    const hasBearer = authHeader?.startsWith("Bearer ");
    let body: Body = {};
    try {
      body = await req.json();
    } catch {}

    const idToken =
      hasBearer ? authHeader!.split(" ")[1] : (typeof body.idToken === "string" ? body.idToken : undefined);

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

    // 3) Firestore: obtener customerId y flag hasTrialUsed
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    const data = snap.data() || {};
    let customerId: string | undefined = data.stripeCustomerId;
    let hasTrialUsed: boolean = data.hasTrialUsed ?? false;

    if (customerId) {
      const c = await safeRetrieveCustomer(customerId);
      if (c) {
        await gaServerEvent("checkout_existing_customer", { uid, customerId, plan });
      }

      // 🔎 Chequear suscripciones activas/canceladas pero en trial
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        expand: ["data.default_payment_method"],
        limit: 5,
      });

      const trialingSub = subs.data.find(
        s => s.status === "trialing" && s.cancel_at_period_end === true
      );

      if (trialingSub) {
        console.log("⚡ Cliente con sub cancelada pero en trial → Portal");
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId!,
          return_url: `${APP_URL}/checkout/callback?success=1&next=${encodeURIComponent(body.next ?? "/dashboard")}`,
        });
        return NextResponse.json({ url: portal.url }, { status: 200 });
      }
    }


    // Guardar flags en Firestore
    await userRef.set(
      {
        stripeCustomerId: customerId,
        hasTrialUsed,
      },
      { merge: true }
    );

    // 4) Decidir trial SOLO según Firestore
    const trialDays = hasTrialUsed ? undefined : 7;

    const next = body.next ?? "/dashboard";
    // ⚡ Si ya usó trial antes → llevar directamente al Portal en lugar de crear otra sesión
    if (hasTrialUsed) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId!,
        return_url: `${APP_URL}/checkout/callback?success=1&next=${encodeURIComponent(next)}`,
      });
      return NextResponse.json({ url: portal.url }, { status: 200 });
    }

    // 5) Crear Checkout Session solo si no ha usado trial nunca
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { uid, plan },
      subscription_data: {
        metadata: { uid, plan },
        ...(trialDays ? { trial_period_days: trialDays } : {}),
      },
      success_url: `${APP_URL}/checkout/callback?success=1&next=${encodeURIComponent(next)}`,
      cancel_url: `${APP_URL}/checkout/callback?cancel=1&next=${encodeURIComponent(next)}`,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
    });

    await gaServerEvent("checkout_session_created", {
      uid,
      customerId,
      plan,
      sessionId: session.id,
      trialDays: trialDays ?? 0,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });

  } catch (e: any) {
    const msg = e?.message || "Internal error creating checkout session";
    console.error("❌ /api/stripe/checkout error:", msg, e);
    await gaServerEvent("checkout_failed", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
