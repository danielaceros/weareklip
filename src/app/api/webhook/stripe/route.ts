// src/app/api/webhook/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { adminDB, adminTimestamp } from "@/lib/firebase-admin";

/* ================== config ================== */

type PlanId = "starter" | "mid" | "creator" | "business" | "usage" | "access";

const DEFAULT_TRIAL_CENTS = Number(process.env.TRIAL_CREDIT_CENTS ?? "500");

// (opcional) precios de uso para crear la sub "usage" tras el checkout
const PRICE_USAGE: string[] = [
  process.env.STRIPE_PRICE_USAGE_SCRIPT!,
  process.env.STRIPE_PRICE_USAGE_VOICE!,
  process.env.STRIPE_PRICE_USAGE_LIPSYNC!,
  process.env.STRIPE_PRICE_USAGE_EDIT!,
].filter(Boolean);

/* ================== helpers ================== */

const tsFromSeconds = (sec?: number) =>
  typeof sec === "number" ? adminTimestamp.fromMillis(sec * 1000) : undefined;

const isStripeError = (x: unknown): x is { type?: string; code?: string; message?: string } =>
  typeof x === "object" && x !== null;

const safeCurrentPeriodEnd = (
  sub: Stripe.Subscription | (Stripe.Subscription & Record<string, unknown>)
): number | undefined => {
  // leer de forma segura sin depender de los tipos de Stripe
  const raw = (sub as Record<string, unknown>)?.["current_period_end"];
  return typeof raw === "number" ? raw : undefined;
};

const emailFromInvoice = (inv: Stripe.Invoice) =>
  inv.customer_email ??
  (inv as unknown as { customer_details?: { email?: string } }).customer_details?.email;

const uidFromInvoice = (inv: Stripe.Invoice) => {
  const fromMeta =
    (inv.metadata?.uid as string | undefined) ??
    (inv as unknown as { subscription_details?: { metadata?: { uid?: string } } })
      .subscription_details?.metadata?.uid;

  if (fromMeta) return fromMeta;

  const line0 = (inv.lines?.data?.[0] ?? {}) as unknown as {
    subscription_details?: { metadata?: { uid?: string } };
    metadata?: { uid?: string };
  };
  return line0.subscription_details?.metadata?.uid ?? line0.metadata?.uid;
};

const subscriptionIdFromInvoice = (evtObj: unknown) => {
  const maybe = (evtObj as Record<string, unknown>)?.["subscription"];
  return typeof maybe === "string" ? maybe : undefined;
};

const planFromSubscription = (sub: Stripe.Subscription): PlanId | undefined => {
  // prioridad a metadata.plan
  const fromMeta = sub.metadata?.plan as PlanId | undefined;
  if (fromMeta) return fromMeta;

  // o bien al lookup_key del primer item
  const price = sub.items?.data?.[0]?.price;
  const lookup = price?.lookup_key as PlanId | undefined;
  return lookup;
};

/** Busca ref de usuario por uid, email, customerId o mapping en /customers */
async function findUserRef({
  uid,
  email,
  customerId,
}: {
  uid?: string;
  email?: string;
  customerId?: string;
}) {
  if (uid) return adminDB.collection("users").doc(uid);

  if (email) {
    const q = await adminDB.collection("users").where("email", "==", email).limit(1).get();
    if (!q.empty) return q.docs[0].ref;
  }

  if (customerId) {
    const q = await adminDB
      .collection("users")
      .where("stripeCustomerId", "==", customerId)
      .limit(1)
      .get();
    if (!q.empty) return q.docs[0].ref;
  }

  if (customerId) {
    const q2 = await adminDB
      .collection("customers")
      .where("stripeId", "==", customerId)
      .limit(1)
      .get();
    if (!q2.empty) {
      const mappedUid = q2.docs[0].id;
      return adminDB.collection("users").doc(mappedUid);
    }
  }

  return undefined;
}

/** Upsert principal en /users/{uid} — devuelve userRef */
async function upsertUser({
  uid,
  email,
  customerId,
  subscriptionId,
  plan,
  status,
  renewal,
  lastPayment,
}: {
  uid?: string;
  email?: string;
  customerId?: string;
  subscriptionId?: string;
  plan?: PlanId;
  status?: Stripe.Subscription.Status;
  renewal?: number; // epoch seconds
  lastPayment?: number; // epoch seconds
}): Promise<FirebaseFirestore.DocumentReference | undefined> {
  const userRef = await findUserRef({ uid, email, customerId });

  if (!userRef) {
    console.warn("[webhook] No encontré userRef:", { uid, email, customerId });
    return;
  }

  const update: Record<string, unknown> = {
    lastUpdated: adminTimestamp.now(),
  };

  if (typeof email === "string") update["email"] = email;
  if (customerId) update["stripeCustomerId"] = customerId;

  const subscription: Record<string, unknown> = {};
  if (subscriptionId) subscription["id"] = subscriptionId;
  if (typeof plan === "string") subscription["plan"] = plan;
  if (typeof status === "string") {
    subscription["status"] = status;
    subscription["active"] = status === "active" || status === "trialing";
  }
  if (typeof renewal === "number") subscription["renewal"] = tsFromSeconds(renewal);

  if (Object.keys(subscription).length) update["subscription"] = subscription;
  if (typeof lastPayment === "number") update["lastPayment"] = tsFromSeconds(lastPayment);

  await userRef.set(update, { merge: true });
  return userRef;
}

/** Mantiene /customers/{uid} con el id/link de Stripe */
async function upsertCustomerMapping(uid: string, customerId: string, email?: string) {
  try {
    const link = `https://dashboard.stripe.com/customers/${customerId}`;
    const data: Record<string, unknown> = { stripeId: customerId, stripeLink: link };
    if (typeof email === "string") data.email = email;
    await adminDB.collection("customers").doc(uid).set(data, { merge: true });
  } catch (e) {
    console.warn("[webhook] No pude escribir mapping en /customers:", e);
  }
}

/** Si la sub está en trial → concede crédito SOLO una vez. */
async function ensureTrialCreditOnce(
  userRef: FirebaseFirestore.DocumentReference,
  customerId: string,
  subStatus?: Stripe.Subscription.Status
) {
  if (subStatus !== "trialing") return;

  const snap = await userRef.get();
  const data = snap.exists ? (snap.data() as FirebaseFirestore.DocumentData) : undefined;

  if (data?.trialCreditEverGranted === true) return;

  await userRef.set(
    {
      trialCreditCents: DEFAULT_TRIAL_CENTS, // p. ej. 500 (5 €)
      trialCreditEverGranted: true,
      trialCreditCustomerId: customerId,
      trialCreditGrantedAt: adminTimestamp.now(),
      lastUpdated: adminTimestamp.now(),
    },
    { merge: true }
  );

  try {
    await stripe.customers.update(customerId, { metadata: { trial_credit_granted: "1" } });
  } catch {
    /* noop */
  }
}

/** Crea (si no existe) la sub de uso con los 4 prices */
async function ensureUsageSubscription(customerId: string, uid?: string) {
  if (!PRICE_USAGE.length) return;

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  const existing = subs.data.find((s) => s.metadata?.plan === "usage" && s.status !== "canceled");
  if (existing) return;

  await stripe.subscriptions.create({
    customer: customerId,
    collection_method: "charge_automatically",
    items: PRICE_USAGE.map((p) => ({ price: p })),
    // no prorrateamos nada; cada price ya define su ciclo (semanal)
    proration_behavior: "none",
    metadata: uid ? { plan: "usage", uid } : { plan: "usage" },
  });
}

/* ================== handler ================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const buf = Buffer.from(await req.arrayBuffer());
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("⚠️ Falta stripe-signature en el webhook");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    event = stripe.webhooks.constructEvent(buf, sig, secret);
  } catch (err) {
    const msg = isStripeError(err) ? err.message : "Invalid signature";
    console.error("❌ Webhook signature error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      /* ------- customer.* → guardamos stripeCustomerId / email ------- */
      case "customer.created":
      case "customer.updated": {
        const c = event.data.object as Stripe.Customer;
        const email = c.email ?? undefined;
        const uid = (c.metadata?.uid as string | undefined) ?? undefined;

        await upsertUser({ uid, email, customerId: c.id });
        if (uid) await upsertCustomerMapping(uid, c.id, email);
        break;
      }

      /* ------------------- checkout.session.completed ------------------- */
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;

        const uid = (s.metadata?.uid as string | undefined) ?? undefined;
        const plan = (s.metadata?.plan as PlanId | undefined) ?? undefined;
        const customerId = (s.customer as string | undefined) ?? undefined;
        const subscriptionId = (s.subscription as string | undefined) ?? undefined;

        let status: Stripe.Subscription.Status | undefined;
        let renewal: number | undefined;

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          status = sub.status;
          renewal = safeCurrentPeriodEnd(sub);
        }

        const userRef = await upsertUser({
          uid,
          email: s.customer_details?.email ?? undefined,
          customerId,
          subscriptionId,
          plan,
          status,
          renewal,
        });

        if (uid && customerId) {
          await upsertCustomerMapping(uid, customerId, s.customer_details?.email ?? undefined);
        }

        // Si arrancó en trial → dar crédito de prueba (una sola vez)
        if (userRef && customerId) {
          await ensureTrialCreditOnce(userRef, customerId, status);
        }

        // Crear la sub de USO (semanal) si no existe
        if (customerId) {
          await ensureUsageSubscription(customerId, uid);
        }

        break;
      }

      /* -------- customer.subscription.created/updated -------- */
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const uid = (sub.metadata?.uid as string | undefined) ?? undefined;
        const plan = planFromSubscription(sub);
        const customerId = (sub.customer as string | undefined) ?? undefined;
        const renewal = safeCurrentPeriodEnd(sub);

        let email: string | undefined;
        if (!uid && customerId) {
          try {
            const c = await stripe.customers.retrieve(customerId);
            if (!("deleted" in c) && c.email) email = c.email;
          } catch {
            /* noop */
          }
        }

        const userRef = await upsertUser({
          uid,
          email,
          customerId,
          subscriptionId: sub.id,
          plan,
          status: sub.status,
          renewal,
        });

        if (uid && customerId) await upsertCustomerMapping(uid, customerId, email);

        if (userRef && customerId) await ensureTrialCreditOnce(userRef, customerId, sub.status);
        break;
      }

      /* ---------------- customer.subscription.deleted ---------------- */
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const uid = (sub.metadata?.uid as string | undefined) ?? undefined;
        const customerId = (sub.customer as string | undefined) ?? undefined;

        let email: string | undefined;
        if (!uid && customerId) {
          try {
            const c = await stripe.customers.retrieve(customerId);
            if (!("deleted" in c) && c.email) email = c.email;
          } catch {
            /* noop */
          }
        }

        await upsertUser({
          uid,
          email,
          customerId,
          subscriptionId: sub.id,
          status: "canceled",
        });
        break;
      }

      /* ---------------------------- invoice.paid ---------------------------- */
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const paidAt = inv.status_transitions?.paid_at ?? inv.created;
        const email = emailFromInvoice(inv);
        const uid = uidFromInvoice(inv);
        const customerId = (inv.customer as string | undefined) ?? undefined;
        const subscriptionId = subscriptionIdFromInvoice(inv as unknown);

        await upsertUser({
          uid,
          email,
          customerId,
          subscriptionId,
          lastPayment: paidAt,
        });
        break;
      }

      default:
        // otros eventos los ignoramos
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const msg = isStripeError(err) && err.message ? err.message : "Webhook handler error";
    console.error("❌ Webhook handler error:", msg, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
