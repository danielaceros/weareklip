// src/app/api/billing/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { gaServerEvent } from "@/lib/ga-server";

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
    if (!idToken) {
      await gaServerEvent("billing_summary_failed", { reason: "missing_id_token" });
      return NextResponse.json({ error: "Missing ID token" }, { status: 401 });
    }

    const { uid, email } = await adminAuth.verifyIdToken(idToken);

    // 2) User doc en Firestore
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      await gaServerEvent("billing_summary_missing_user", { uid, email });
      return NextResponse.json(
        { error: "Usuario no encontrado en Firestore" },
        { status: 404 }
      );
    }

    const user = snap.data();
    const customerId: string | undefined = user?.stripeCustomerId;
    const trialCreditCents: number = user?.trialCreditCents ?? 0;

    if (!customerId) {
      await gaServerEvent("billing_summary_no_subscription", { uid, email, trialCreditCents });
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
          pendingUsageCents: 0,   // 👈 corregido
          trialCreditCents,
          payment: { hasDefaultPayment: false },
          hasOverdue: false,      // 👈 añadido
          overdueCents: 0,        // 👈 añadido
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
      await gaServerEvent("billing_summary_no_subscription", { uid, email, customerId, trialCreditCents });
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
          pendingUsageCents: 0,   // 👈 corregido
          trialCreditCents,
          payment: {
            hasDefaultPayment:
              !!customer.invoice_settings?.default_payment_method ||
              !!customer.default_source,
          },
          hasOverdue: false,      // 👈 añadido
          overdueCents: 0,        // 👈 añadido
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
      ? sub.trial_end
      : sub.items.data[0].current_period_end
      ? sub.items.data[0].current_period_end
      : null;

    // 6) Uso y consumo variable
    const usage: UsageMap = { script: 0, voice: 0, lipsync: 0, edit: 0 };
    let pendingUsageCents = 0;

    try {
      const preview = await stripe.invoices.createPreview({
        customer: customerId!,
        subscription: sub.id,
        expand: ["lines.data.price"],
      });

      for (const line of preview?.lines?.data ?? []) {
        const priceId = line.id;
        const amount = line.amount ?? 0;

        if (
          priceId === process.env.STRIPE_PRICE_USAGE_SCRIPT ||
          priceId === process.env.STRIPE_PRICE_USAGE_VOICE ||
          priceId === process.env.STRIPE_PRICE_USAGE_LIPSYNC ||
          priceId === process.env.STRIPE_PRICE_USAGE_EDIT
        ) {
          pendingUsageCents += amount;

          const qty = line.quantity ?? 0;
          switch (priceId) {
            case process.env.STRIPE_PRICE_USAGE_SCRIPT:
              usage.script = qty;
              break;
            case process.env.STRIPE_PRICE_USAGE_VOICE:
              usage.voice = qty;
              break;
            case process.env.STRIPE_PRICE_USAGE_LIPSYNC:
              usage.lipsync = qty;
              break;
            case process.env.STRIPE_PRICE_USAGE_EDIT:
              usage.edit = qty;
              break;
          }
        }
      }
    } catch (err) {
      console.warn("No se pudo calcular usage:", err);
    }

    // 7) Facturas vencidas
    let hasOverdue = false;
    let overdueCents = 0;

    try {
      const invoices = await stripe.invoices.list({
        customer: customerId!,
        status: "open", // incluye past_due
        limit: 50,
      });
      overdueCents = invoices.data.reduce(
        (acc, inv) => acc + (inv.amount_remaining ?? 0),
        0
      );
      if (overdueCents > 0) hasOverdue = true;
    } catch (err) {
      console.warn("No se pudo calcular overdueCents:", err);
    }

    const hasDefaultPayment =
      !!customer.invoice_settings?.default_payment_method ||
      !!customer.default_source;

    // 8) Tracking GA
    await gaServerEvent("billing_summary_requested", {
      uid,
      email,
      customerId,
      subscription_status: status,
      active,
      trialing,
      cancelAtPeriodEnd,
      planName,
      renewalAt,
      trialCreditCents,
      usage,
      pendingUsageCents,
      overdueCents,
      hasDefaultPayment,
    });

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
        pendingUsageCents,
        trialCreditCents,
        payment: { hasDefaultPayment },
        hasOverdue,
        overdueCents,
        debug: { customerId, reconciled: true },
      },
      { status: 200 }
    );
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : "summary error";
    console.error("❌ /api/billing/summary:", msg, e);

    await gaServerEvent("billing_summary_failed", {
      error: msg,
    });

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
