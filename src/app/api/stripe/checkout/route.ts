// src/app/api/stripe/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminAuth, adminDB, adminTimestamp } from "@/lib/firebase-admin";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Solo tienes “Access” ahora mismo. Si añades más, declara aquí sus PRICE_ID */
const PRICE_BY_PLAN: Record<"ACCESS" | "MID" | "CREATOR" | "BUSINESS", string | undefined> = {
  ACCESS: process.env.STRIPE_PRICE_ACCESS,
  MID: process.env.STRIPE_PRICE_MID,
  CREATOR: process.env.STRIPE_PRICE_CREATOR,
  BUSINESS: process.env.STRIPE_PRICE_BUSINESS,
};

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3000";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
function isStripeDeleted(c: Stripe.Customer | Stripe.DeletedCustomer): c is Stripe.DeletedCustomer {
  return "deleted" in c && (c as Stripe.DeletedCustomer).deleted === true;
}
async function safeRetrieveCustomer(id: string): Promise<Stripe.Customer | null> {
  try {
    const c = await stripe.customers.retrieve(id);
    if (isStripeDeleted(c)) return null;
    return c as Stripe.Customer;
  } catch (e: any) {
    if (e?.type === "StripeInvalidRequestError" || e?.code === "resource_missing") return null;
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1) Auth (Bearer idToken o body.idToken)
    const authHeader = req.headers.get("authorization");
    const hasBearer = authHeader?.startsWith("Bearer ");
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const idToken = hasBearer
      ? authHeader!.slice(7)
      : (typeof body?.idToken === "string" ? body.idToken : undefined);

    if (!idToken) return jsonError("Missing ID token", 401);

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const emailFromToken = (decoded as any)?.email as string | undefined;

    // 2) Resolver priceId (por plan o por priceId explícito)
    let priceId: string | undefined;
    if (typeof body?.priceId === "string" && body.priceId) {
      priceId = body.priceId;
    } else if (typeof body?.plan === "string") {
      const plan = body.plan.toUpperCase() as keyof typeof PRICE_BY_PLAN;
      priceId = PRICE_BY_PLAN[plan];
      if (!priceId) return jsonError(`No hay price configurado para el plan ${plan}`, 400);
      body.plan = plan;
    } else {
      priceId = PRICE_BY_PLAN.ACCESS;
      body.plan = "ACCESS";
      if (!priceId) return jsonError("Falta STRIPE_PRICE_ACCESS en las env vars", 500);
    }

    // 3) Leer doc usuario y customerId
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    const userData = snap.exists ? (snap.data() as any) : {};
    let customerId: string | undefined = userData?.stripeCustomerId || undefined;
    let hasTrialUsed: boolean = !!userData?.hasTrialUsed;

    // Si no hay customerId, créalo ahora
    if (!customerId) {
      const c = await stripe.customers.create({
        email: emailFromToken || body?.email,
        metadata: { uid },
      });
      customerId = c.id;
      await userRef.set(
        {
          email: (emailFromToken || body?.email) ?? null,
          stripeCustomerId: customerId,
          lastUpdated: adminTimestamp.now(),
        },
        { merge: true }
      );
    } else {
      // sanity check del customer
      await safeRetrieveCustomer(customerId);
    }

    // 4) Si ya tiene sub activa/trial → portal
    const list = await stripe.subscriptions.list({
      customer: customerId!,
      status: "all",
      expand: ["data.default_payment_method"],
      limit: 10,
    });
    const subs = list.data;
    const hasActive = subs.some((s) => s.status === "active");
    const hasTrialing = subs.some((s) => s.status === "trialing");
    const hasTrialingCanceled = subs.some((s) => s.status === "trialing" && s.cancel_at_period_end);

    if (hasActive || hasTrialing || hasTrialingCanceled) {
      const next = typeof body?.next === "string" ? body.next : "/dashboard";
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId!,
        return_url: `${APP_URL}/checkout/callback?success=1&next=${encodeURIComponent(next)}`,
      });
      return NextResponse.json({ url: portal.url });
    }

    // 5) Guardar flags actuales
    await userRef.set(
      {
        stripeCustomerId: customerId,
        hasTrialUsed,
        lastUpdated: adminTimestamp.now(),
      } as any,
      { merge: true }
    );

    // 6) Trial si nunca lo usó
    const trialDays = hasTrialUsed ? undefined : 7;
    const next = typeof body?.next === "string" ? body.next : "/dashboard";

    // 7) Crear Checkout Session (solo tarjeta)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"], // <- solo tarjeta (sin Amazon Pay, Klarna, etc.)
      customer: customerId!,
      line_items: [{ price: priceId!, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      metadata: { uid, plan: String(body?.plan || "") },
      subscription_data: {
        metadata: { uid, plan: String(body?.plan || "") },
        ...(trialDays ? { trial_period_days: trialDays } : {}),
      },
      success_url: `${APP_URL}/checkout/callback?success=1&next=${encodeURIComponent(next)}`,
      cancel_url: `${APP_URL}/checkout/callback?cancel=1&next=${encodeURIComponent(next)}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    const msg = e?.message || "Internal error creating checkout session";
    console.error("❌ /api/stripe/checkout:", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
