// src/app/api/webhook/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { adminDB, adminTimestamp, adminFieldValue } from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server";
import { sendEventPush } from "@/lib/sendEventPush";

/* ================== config ================== */

type PlanId = "starter" | "mid" | "creator" | "business" | "usage" | "access";

const DEFAULT_TRIAL_CENTS = Number(process.env.TRIAL_CREDIT_CENTS ?? "500");
const USAGE_THRESHOLD_CENTS = Number(process.env.USAGE_THRESHOLD_CENTS || "0");

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

const safeNumber = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

const safeCurrentPeriodEnd = (
  sub: Stripe.Subscription | (Stripe.Subscription & Record<string, unknown>)
): number | undefined => {
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
  const fromMeta = sub.metadata?.plan as PlanId | undefined;
  if (fromMeta) return fromMeta;
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

/** Resuelve uid por customerId o email (útil para pushes si no viene en metadata). */
async function resolveUidByCustomerOrEmail(
  customerId?: string,
  email?: string
): Promise<string | undefined> {
  const ref = await findUserRef({ uid: undefined, email, customerId });
  return ref?.id;
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
  renewal?: number;
  lastPayment?: number;
}): Promise<FirebaseFirestore.DocumentReference | undefined> {
  const userRef = await findUserRef({ uid, email, customerId });

  if (!userRef) {
    console.warn("[webhook] No encontré userRef:", { uid, email, customerId });
    return;
  }

  const update: Record<string, unknown> = { lastUpdated: adminTimestamp.now() };
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
      trialCreditCents: DEFAULT_TRIAL_CENTS,
      trialCreditEverGranted: true,
      trialCreditCustomerId: customerId,
      trialCreditGrantedAt: adminTimestamp.now(),
      lastUpdated: adminTimestamp.now(),
    },
    { merge: true }
  );

  await gaServerEvent("trial_credit_granted", { uid: userRef.id, customerId });

  try {
    await stripe.customers.update(customerId, { metadata: { trial_credit_granted: "1" } });
  } catch {}
}

/** Crea (si no existe) la sub de uso con los prices, PM por defecto y umbral */
async function ensureUsageSubscription(customerId: string, uid?: string) {
  if (!PRICE_USAGE.length) return;

  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
  const existing = subs.data.find((s) => s.metadata?.plan === "usage" && s.status !== "canceled");
  if (existing) return;

  let defaultPm: string | undefined;
  try {
    const c = await stripe.customers.retrieve(customerId);
    if (!("deleted" in c)) {
      const pm = c.invoice_settings?.default_payment_method as string | Stripe.PaymentMethod | null;
      defaultPm = typeof pm === "string" ? pm : pm?.id;
    }
  } catch {}

  if (!defaultPm) {
    const access = subs.data.find((s) => s.metadata?.plan === "access" && s.status !== "canceled");
    const pm = access?.default_payment_method as string | Stripe.PaymentMethod | null | undefined;
    defaultPm = typeof pm === "string" ? pm : pm?.id;
  }

  const threshold =
    Number.isFinite(USAGE_THRESHOLD_CENTS) && USAGE_THRESHOLD_CENTS > 0
      ? { amount_gte: USAGE_THRESHOLD_CENTS }
      : undefined;

  await stripe.subscriptions.create({
    customer: customerId,
    collection_method: "charge_automatically",
    default_payment_method: defaultPm,
    payment_settings: { save_default_payment_method: "on_subscription" },
    ...(threshold ? { billing_thresholds: threshold } : {}),
    items: PRICE_USAGE.map((p) => ({ price: p })),
    proration_behavior: "none",
    metadata: uid ? { plan: "usage", uid } : { plan: "usage" },
  });

  await gaServerEvent("usage_subscription_created", { uid, customerId });
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
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const msg = isStripeError(err) ? err.message : "Invalid signature";
    console.error("❌ Webhook signature error:", msg);
    await gaServerEvent("stripe_webhook_signature_error", { msg });
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.created":
      case "customer.updated": {
        const c = event.data.object as Stripe.Customer;
        await upsertUser({ uid: c.metadata?.uid, email: c.email ?? undefined, customerId: c.id });
        if (c.metadata?.uid) await upsertCustomerMapping(c.metadata.uid, c.id, c.email ?? undefined);
        await gaServerEvent("stripe_customer_upserted", { customerId: c.id });
        break;
      }

      /* ------------------- checkout.session.completed ------------------- */
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        await gaServerEvent("checkout_completed", { uid: s.metadata?.uid, plan: s.metadata?.plan });
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

        // 👉 Marcar que ya usó su trial (aunque lo cancele después)
        if (uid) {
          await adminDB.collection("users").doc(uid).set(
            { hasTrialUsed: true },
            { merge: true }
          );
        }

        // Si arrancó en trial → dar crédito de prueba (una sola vez)
        if (userRef && customerId) {
          await ensureTrialCreditOnce(userRef, customerId, status);
        }

        // Guardar el PM en el Customer para que Usage cobre solo
        if (subscriptionId && customerId) {
          try {
            const params: Stripe.SubscriptionUpdateParams = {
              payment_settings: { save_default_payment_method: "on_subscription" },
            };
            await stripe.subscriptions.update(subscriptionId, params);
          } catch {
            /* ok si falla; continuamos */
          }

          const sub = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["default_payment_method"],
          });

          let pmId: string | undefined =
            typeof sub.default_payment_method === "string"
              ? sub.default_payment_method
              : sub.default_payment_method?.id;

          if (!pmId) {
            const pms = await stripe.paymentMethods.list({
              customer: customerId,
              type: "card",
              limit: 1,
            });
            pmId = pms.data[0]?.id;
          }

          if (pmId) {
            await stripe.customers.update(customerId, {
              invoice_settings: { default_payment_method: pmId },
            });
          }
        }

        // Crear la sub de USO (diaria) si no existe — ahora con PM y umbral (si definido)
        if (customerId) {
          await ensureUsageSubscription(customerId, uid);
        }

        break;
      }


      /* -------- customer.subscription.created/updated -------- */
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        await gaServerEvent("subscription_updated", {
          uid: sub.metadata?.uid,
          plan: sub.metadata?.plan,
          status: sub.status,
        });

        const uidMeta = (sub.metadata?.uid as string | undefined) ?? undefined;
        const plan = planFromSubscription(sub);
        const customerId = (sub.customer as string | undefined) ?? undefined;
        const renewal = safeCurrentPeriodEnd(sub);

        let email: string | undefined;
        if (!uidMeta && customerId) {
          try {
            const c = await stripe.customers.retrieve(customerId);
            if (!("deleted" in c) && c.email) email = c.email;
          } catch {
            /* noop */
          }
        }

        const userRef = await upsertUser({
          uid: uidMeta,
          email,
          customerId,
          subscriptionId: sub.id,
          plan,
          status: sub.status,
          renewal,
        });

        if (uidMeta && customerId) await upsertCustomerMapping(uidMeta, customerId, email);
        if (userRef && customerId) await ensureTrialCreditOnce(userRef, customerId, sub.status);

        // Marcar bloqueo si el estado es malo
        const bad = ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(
          sub.status
        );
        const ref = userRef ?? (await findUserRef({ uid: uidMeta, email, customerId }));
        if (ref) {
          await ref.set(
            bad
              ? {
                  billingBlocked: true,
                  billingBlockedReason: "subscription_" + sub.status,
                  lastUpdated: adminTimestamp.now(),
                }
              : {
                  billingBlocked: false,
                  billingBlockedReason: adminFieldValue.delete(),
                  lastUpdated: adminTimestamp.now(),
                },
            { merge: true }
          );
        }

        // ▶️ Notificaciones: trial/active con deduplicación
        try {
          const prev = (event.data as any).previous_attributes as { status?: string } | undefined;
          const uidForPush =
            uidMeta ?? (await resolveUidByCustomerOrEmail(customerId, email));

          // “reciente” = creado hace menos de 2 minutos
          const justCreated =
            typeof sub.created === "number" && (Date.now() / 1000 - sub.created) < 120;

          if (!uidForPush) {
            console.warn("[push] sub.created/updated sin uid resoluble", {
              customerId,
              email,
              status: sub.status,
            });
          } else {
            if (event.type === "customer.subscription.created") {
              if (sub.status === "trialing") {
                await sendEventPush(uidForPush, "trial_started", {
                  plan: String(plan ?? ""),
                });
              } else if (sub.status === "active") {
                await sendEventPush(uidForPush, "subscription_active", {
                  plan: String(plan ?? ""),
                });
              }
            } else if (event.type === "customer.subscription.updated") {
              // Solo cuando pasa de trialing → active y NO justo tras crearse
              if (prev?.status === "trialing" && sub.status === "active" && !justCreated) {
                await sendEventPush(uidForPush, "subscription_active", {
                  plan: String(plan ?? ""),
                });
              }
            }
          }
        } catch (e) {
          console.warn("[push] subscription created/updated error", e);
        }

        break;
      }

      /* ---------------- customer.subscription.deleted ---------------- */
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await gaServerEvent("subscription_deleted", {
          uid: sub.metadata?.uid,
          plan: sub.metadata?.plan,
        });
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
        await gaServerEvent("invoice_paid", { uid: uidFromInvoice(inv), amount: inv.amount_paid });

        const paidAt = inv.status_transitions?.paid_at ?? inv.created;
        const email = emailFromInvoice(inv);
        const uid = uidFromInvoice(inv);
        const customerId = (inv.customer as string | undefined) ?? undefined;
        const subscriptionId = subscriptionIdFromInvoice(inv as unknown);

        // Upsert básico (último pago, etc.)
        const ref = await upsertUser({
          uid,
          email,
          customerId,
          subscriptionId,
          lastPayment: paidAt,
        });

        // ¿Es la suscripción de USO?
        let isUsage = false;
        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            isUsage = sub.metadata?.plan === "usage";
          } catch {
            /* noop */
          }
        }

        // Desbloquear siempre en pago correcto
        if (ref) {
          const baseUpdate: Record<string, unknown> = {
            billingBlocked: false,
            billingBlockedReason: adminFieldValue.delete(),
            pastDueAmountCents: 0,
            lastUpdated: adminTimestamp.now(),
          };

          // Si es la de uso: reseteo del acumulado y sello de reset
          if (isUsage) {
            const periodEndSec =
              typeof inv.period_end === "number" ? inv.period_end : undefined;
            if (periodEndSec) {
              baseUpdate["pendingLocalCents"] = 0;
              baseUpdate["pendingLocalResetAt"] = adminTimestamp.fromMillis(
                periodEndSec * 1000
              );
            } else {
              baseUpdate["pendingLocalCents"] = 0;
              baseUpdate["pendingLocalResetAt"] = adminTimestamp.now();
            }
          }

          await ref.set(baseUpdate, { merge: true });

          // ▶️ Notificación de “renovada” SOLO en ciclos reales (no en la 1ª factura)
          try {
            const reason = inv.billing_reason as Stripe.Invoice.BillingReason | undefined;
            const isRenewal = reason === "subscription_cycle"; // <- clave
            const uidPaid =
              uidFromInvoice(inv) ??
              (await resolveUidByCustomerOrEmail(inv.customer as string | undefined, email));

            if (uidPaid && !isUsage && isRenewal) {
              await sendEventPush(uidPaid, "subscription_renewed", {
                invoiceId: inv.id,
                amountPaid: String(inv.amount_paid ?? 0),
              });
            }
          } catch (e) {
            console.warn("[push] invoice.paid error", e);
          }
        }
        break;
      }

      /* ------------------------ invoice.payment_failed ------------------------ */
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        await gaServerEvent("invoice_payment_failed", {
          uid: uidFromInvoice(inv),
          amount: inv.amount_due,
        });
        const email = emailFromInvoice(inv);
        const uid = uidFromInvoice(inv);
        const customerId = (inv.customer as string | undefined) ?? undefined;

        const userRef = await findUserRef({ uid, email, customerId });
        if (userRef) {
          await userRef.set(
            {
              billingBlocked: true,
              billingBlockedReason: "payment_failed",
              pastDueAmountCents:
                typeof inv.amount_remaining === "number"
                  ? inv.amount_remaining
                  : safeNumber(inv.amount_due),
              lastUpdated: adminTimestamp.now(),
            },
            { merge: true }
          );
        }

        // ▶️ Notificación push (pago fallido)
        try {
          const uidFail =
            uidFromInvoice(inv) ??
            (await resolveUidByCustomerOrEmail(inv.customer as string | undefined, email));
          if (uidFail) {
            await sendEventPush(uidFail, "payment_failed", {
              invoiceId: inv.id,
              amountDue: String(inv.amount_due ?? inv.amount_remaining ?? 0),
            });
          }
        } catch (e) {
          console.warn("[push] payment_failed error", e);
        }

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
    await gaServerEvent("stripe_webhook_failed", { reason: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
