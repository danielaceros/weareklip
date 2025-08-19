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
      return null; // el customer no existe en este entorno
    }
    throw e; // otros errores reales
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1) Auth (Authorization: Bearer <idToken> o en el body)
    const authHeader = req.headers.get("authorization");
    const hasBearer = authHeader?.startsWith("Bearer ");
    let body: Body = {};
    try {
      body = await req.json();
    } catch {
      // sin body -> ok
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
    const email = decoded.email || decoded.firebase?.identities?.email?.[0];
    if (!email) {
      return NextResponse.json({ error: "Email not available" }, { status: 400 });
    }

    // 2) Validar plan
    const plan = body.plan;
    if (!plan || !(plan in PRICE_BY_PLAN)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    const priceId = PRICE_BY_PLAN[plan];

    // 3) Resolver/crear customer robusto
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    const savedId = (snap.data()?.stripeCustomerId as string | undefined) ?? undefined;

    let customerId: string | undefined;

    if (savedId) {
      const c = await safeRetrieveCustomer(savedId);
      if (c) customerId = c.id;
    }

    if (!customerId) {
      const list = await stripe.customers.list({ email, limit: 1 });
      if (list.data.length > 0) customerId = list.data[0].id;
    }

    if (!customerId) {
      const created = await stripe.customers.create({ email, metadata: { uid } });
      customerId = created.id;
    }

    // guardar/actualizar (sobrescribe IDs inválidos)
    await userRef.set({ stripeCustomerId: customerId }, { merge: true });

    // 4) Checkout Session
   const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: customerId,
  payment_method_types: ["card"],
  line_items: [{ price: priceId, quantity: 1 }],
  metadata: { uid, plan },
  subscription_data: { metadata: { uid, plan } },
  success_url: `${APP_URL}/dashboard?success=1`,
  cancel_url: `${APP_URL}/dashboard/facturacion?cancel=1`,
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
