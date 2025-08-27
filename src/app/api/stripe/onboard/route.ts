// src/app/api/billing/onboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { adminAuth, adminDB } from "@/lib/firebase-admin";
import type { DecodedIdToken } from "firebase-admin/auth";
import { gaServerEvent } from "@/lib/ga-server"; // 👈 añadido

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCESS_PRICE = process.env.STRIPE_PRICE_ACCESS!;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3000";

const FALLBACK_TRIAL_DAYS = 7 as const;

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
  } catch (e) {
    if (isStripeError(e) && (e.type === "StripeInvalidRequestError" || e.code === "resource_missing")) {
      return null;
    }
    throw e;
  }
}
function emailFromDecoded(decoded: DecodedIdToken): string | undefined {
  if (typeof decoded.email === "string" && decoded.email) return decoded.email;
  type MaybeIdentities = { firebase?: { identities?: { email?: unknown } } };
  const identities = (decoded as unknown as MaybeIdentities).firebase?.identities;
  const candidate = identities?.email;
  if (Array.isArray(candidate) && typeof candidate[0] === "string") return candidate[0];
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    // 1) Auth
    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;

    let idToken: string | undefined = bearer;
    if (!idToken) {
      try {
        const body = (await req.json()) as Partial<{ idToken: string }>;
        if (typeof body?.idToken === "string") idToken = body.idToken;
      } catch {}
    }
    if (!idToken) {
      await gaServerEvent("onboard_missing_token", {});
      return NextResponse.json({ error: "Missing ID token" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = emailFromDecoded(decoded);
    if (!email) {
      await gaServerEvent("onboard_missing_email", { uid });
      return NextResponse.json({ error: "Email not available" }, { status: 400 });
    }

    // 2) Buscar/crear Customer y guardar mapping
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();

    let customerId: string | undefined =
      (snap.data()?.stripeCustomerId as string | undefined) ?? undefined;

    if (customerId) {
      const c = await safeRetrieveCustomer(customerId);
      if (!c) customerId = undefined;
    }
    if (!customerId) {
      const list = await stripe.customers.list({ email, limit: 1 });
      if (list.data.length > 0) {
        customerId = list.data[0].id;
      }
    }
    if (!customerId) {
      const created = await stripe.customers.create({
        email,
        metadata: { uid },
      });
      customerId = created.id;
      await gaServerEvent("stripe_customer_created", { uid, customerId, email });
    }
    await userRef.set({ stripeCustomerId: customerId }, { merge: true });

    // 3) Checkout Session de la suscripción "Access" (con trial)
    if (!ACCESS_PRICE) {
      return NextResponse.json(
        { error: "Missing STRIPE_PRICE_ACCESS env var" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      payment_method_collection: "always",
      line_items: [{ price: ACCESS_PRICE, quantity: 1 }],
      subscription_data: {
        trial_period_days: FALLBACK_TRIAL_DAYS,
        metadata: { uid, plan: "access" },
      },
      metadata: { uid, plan: "access" },
      allow_promotion_codes: true,
      success_url: `${APP_URL}/dashboard?welcome=1`,
      cancel_url: `${APP_URL}/dashboard/?cancel=1`,
    });

    if (!session.url) {
      throw new Error("Stripe no devolvió la URL de checkout");
    }

    await gaServerEvent("onboard_checkout_created", { uid, customerId, email, plan: "access" });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Onboard error";
    console.error("❌ /api/billing/onboard:", msg, e);
    await gaServerEvent("onboard_failed", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
