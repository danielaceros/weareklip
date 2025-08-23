// src/app/api/billing/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UsageMap = { script: number; voice: number; lipsync: number; edit: number };

function pickBestSubStatus(subs: Stripe.Subscription[]) {
  const order = [
    "active",
    "trialing",
    "past_due",
    "incomplete",
    "incomplete_expired",
    "paused",
    "unpaid",
    "canceled",
  ];
  let best: Stripe.Subscription | null = null;
  let bestRank = 999;
  for (const s of subs) {
    const r = order.indexOf(s.status);
    if (r >= 0 && r < bestRank) {
      best = s;
      bestRank = r;
    }
  }
  return best;
}

export async function GET(req: NextRequest) {
  try {
    // 1) Auth
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    if (!idToken)
      return NextResponse.json({ error: "Missing ID token" }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);

    // 2) User doc en Firestore
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado en Firestore" },
        { status: 404 }
      );
    }

    const user = snap.data();
    const customerId: string | undefined = user?.stripeCustomerId;
    if (!customerId) {
      return NextResponse.json(
        {
          subscription: {
            status: null,
            active: false,
            plan: null,
            renewalAt: null,
            trialing: false,
            cancelAtPeriodEnd: false,
          },
          usage: { script: 0, voice: 0, lipsync: 0, edit: 0 },
          pendingCents: 0,
          payment: { hasDefaultPayment: false },
          debug: { customerId: null, reconciled: false },
        },
        { status: 200 }
      );
    }

    // 3) Buscar subs
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      expand: ["data.items.data.price"],
    });
    const sub = pickBestSubStatus(subs.data);

    // 4) Recuperar customer
    const customer = (await stripe.customers.retrieve(
      customerId
    )) as Stripe.Customer;

    if (!sub) {
      return NextResponse.json(
        {
          subscription: {
            status: null,
            active: false,
            plan: null,
            renewalAt: null,
            trialing: false,
            cancelAtPeriodEnd: false,
          },
          usage: { script: 0, voice: 0, lipsync: 0, edit: 0 },
          pendingCents: 0,
          payment: {
            hasDefaultPayment:
              !!customer.invoice_settings?.default_payment_method ||
              !!customer.default_source,
          },
          debug: { customerId, reconciled: true },
        },
        { status: 200 }
      );
    }

    // 5) Estado y plan
    const status = sub.status;
    const trialing = status === "trialing";
    const cancelAtPeriodEnd = sub.cancel_at_period_end === true;
    const active =
      (status === "active" || status === "trialing") && !cancelAtPeriodEnd;

    const planItem = sub.items.data.find(
      (it) => it.price.recurring?.interval === "month"
    );
    const planName = planItem?.price?.nickname || "Access";

    const renewalAt = sub.trial_end
      ? sub.trial_end * 1000
      : sub.items.data[0].current_period_end
      ? sub.items.data[0].current_period_end * 1000
      : null;

    // 6) Uso
    const usage: UsageMap = { script: 0, voice: 0, lipsync: 0, edit: 0 };
    for (const item of sub.items.data) {
      if (item.price.recurring?.usage_type === "metered") {
        const summaries =
          await (stripe.subscriptionItems as any).listUsageRecordSummaries(
            item.id,
            { limit: 1 }
          );
        const total = summaries.data?.[0]?.total_usage ?? 0;
        switch (item.price.id) {
          case process.env.STRIPE_PRICE_USAGE_SCRIPT:
            usage.script = total;
            break;
          case process.env.STRIPE_PRICE_USAGE_VOICE:
            usage.voice = total;
            break;
          case process.env.STRIPE_PRICE_USAGE_LIPSYNC:
            usage.lipsync = total;
            break;
          case process.env.STRIPE_PRICE_USAGE_EDIT:
            usage.edit = total;
            break;
        }
      }
    }

    // 7) Facturación pendiente
    let pendingCents = 0;
    try {
      const upcoming = await (stripe.invoices as any).retrieveUpcoming({
        customer: customerId!,
        expand: ["lines.data.price"],
      });
      for (const line of upcoming?.lines?.data ?? []) {
        if (line.price?.recurring?.usage_type === "metered") {
          pendingCents += line.amount ?? 0;
        }
      }
    } catch {
      pendingCents = 0;
    }

    // 8) Info de método de pago
    const hasDefaultPayment =
      !!customer.invoice_settings?.default_payment_method ||
      !!customer.default_source;

    // 9) Respuesta
    return NextResponse.json(
      {
        subscription: {
          status,
          active,
          plan: planName,
          renewalAt,
          trialing,
          cancelAtPeriodEnd,
        },
        usage,
        pendingCents,
        payment: { hasDefaultPayment },
        debug: { customerId, reconciled: true },
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "summary error";
    console.error("❌ /api/billing/summary:", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
