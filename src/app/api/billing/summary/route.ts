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
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    if (!idToken) {
      await gaServerEvent("billing_summary_failed", { reason: "missing_id_token" });
      return NextResponse.json({ error: "Missing ID token" }, { status: 401 });
    }

    const { uid, email } = await adminAuth.verifyIdToken(idToken);

    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      await gaServerEvent("billing_summary_missing_user", { uid, email });
      return NextResponse.json({ error: "Usuario no encontrado en Firestore" }, { status: 404 });
    }

    const user = snap.data() as { stripeCustomerId?: string; isGiftUsed?: boolean } | undefined;
    const customerId: string | undefined = user?.stripeCustomerId;

    if (!customerId) {
      return NextResponse.json(
        {
          subscriptions: { monthly: null, usage: null },
          usage: { script: 0, voice: 0, lipsync: 0, edit: 0 },
          pendingUsageCents: 0,
          credits: { availableCents: 0, currency: null },
          payment: { hasDefaultPayment: false },
          hasOverdue: false,
          overdueCents: 0,
          trial: {
            available: user?.isGiftUsed === false || !user?.isGiftUsed,
            used: user?.isGiftUsed === true,
          },
          debug: { customerId: null, reconciled: false },
        },
        { status: 200 }
      );
    }

    // Subs Stripe
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      expand: ["data.items.data.price"],
    });

    const monthlyPlans = [
      process.env.STRIPE_PRICE_ACCESS,
      process.env.STRIPE_PRICE_MID,
      process.env.STRIPE_PRICE_CREATOR,
      process.env.STRIPE_PRICE_BUSINESS,
    ];
    const usagePlans = [
      process.env.STRIPE_PRICE_USAGE_SCRIPT,
      process.env.STRIPE_PRICE_USAGE_VOICE,
      process.env.STRIPE_PRICE_USAGE_LIPSYNC,
      process.env.STRIPE_PRICE_USAGE_EDIT,
    ];

    const monthlySubs = subs.data.filter((s) =>
      s.items.data.some((it) => monthlyPlans.includes(it.price.id))
    );
    const usageSubs = subs.data.filter((s) =>
      s.items.data.some((it) => usagePlans.includes(it.price.id))
    );

    const monthly = monthlySubs.length > 0 ? pickBestSubStatus(monthlySubs) : null;
    const usageSub = usageSubs.length > 0 ? pickBestSubStatus(usageSubs) : null;

    const customer = (await stripe.customers.retrieve(customerId)) as Stripe.Customer;

    const parseSub = (sub: Stripe.Subscription | null) => {
      if (!sub) return null;
      let status = sub.status;
      if (sub.cancel_at_period_end) status = "canceled";

      const trialing = status === "trialing";
      const active = status === "active" || status === "trialing";

      const planItem = sub.items.data.find((it) => it.price.recurring?.interval === "month");
      const planName = planItem?.price?.nickname || sub.items.data[0]?.price?.nickname || null;

      const renewalAt = sub.trial_end
        ? sub.trial_end
        : sub.items.data[0].current_period_end ?? null;

      return {
        id: sub.id,
        status,
        active,
        plan: planName,
        renewalAt,
        trialing,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    };

    const usage: UsageMap = { script: 0, voice: 0, lipsync: 0, edit: 0 };
    let pendingUsageCents = 0;

    if (usageSub) {
      try {
        const preview = await stripe.invoices.createPreview({
          customer: customerId!,
          subscription: usageSub.id,
          expand: ["lines.data.price"],
        });
        for (const line of preview?.lines?.data ?? []) {
          const priceId = (line as any).pricing?.price_details?.price;
          const amount = line.amount ?? 0;
          if (!priceId) continue;

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
    }

    let availableCredits = 0;
    let creditCurrency: string | null = null;
    try {
      const grants = await stripe.billing.creditGrants.list({ customer: customerId, limit: 1 });
      const grantId = grants.data[0]?.id;
      if (grantId) {
        const summary = await stripe.billing.creditBalanceSummary.retrieve({
          customer: customerId,
          filter: { type: "credit_grant", credit_grant: grantId },
        } as any);
        const balance = summary.balances?.[0]?.available_balance?.monetary;
        if (balance) {
          availableCredits = balance.value ?? 0;
          creditCurrency = balance.currency ?? null;
        }
      }
    } catch (err) {
      console.warn("No se pudo recuperar creditBalanceSummary:", err);
    }

    let hasOverdue = false;
    let overdueCents = 0;
    try {
      const invoices = await stripe.invoices.list({ customer: customerId!, status: "open", limit: 50 });
      overdueCents = invoices.data.reduce((acc, inv) => acc + (inv.amount_remaining ?? 0), 0);
      if (overdueCents > 0) hasOverdue = true;
    } catch (err) {
      console.warn("No se pudo calcular overdueCents:", err);
    }

    const hasDefaultPayment = !!customer.invoice_settings?.default_payment_method || !!customer.default_source;

    await gaServerEvent("billing_summary_requested", {
      uid,
      email,
      customerId,
      monthly_status: monthly?.status ?? null,
      usage_status: usageSub?.status ?? null,
      credits: availableCredits,
      usage,
      pendingUsageCents,
      overdueCents,
      hasDefaultPayment,
    });

    return NextResponse.json(
      {
        subscriptions: { monthly: parseSub(monthly), usage: parseSub(usageSub) },
        usage,
        pendingUsageCents,
        credits: { availableCents: availableCredits, currency: creditCurrency },
        payment: { hasDefaultPayment },
        hasOverdue,
        overdueCents,
        trial: {
          available: user?.isGiftUsed === false || !user?.isGiftUsed,
          used: user?.isGiftUsed === true,
        },
        debug: { customerId, reconciled: true },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("❌ /api/billing/summary:", e);
    await gaServerEvent("billing_summary_failed", { error: e.message ?? "summary error" });
    return NextResponse.json({ error: e.message ?? "summary error" }, { status: 500 });
  }
}
