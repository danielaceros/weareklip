// src/app/api/billing/usage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  adminAuth,
  adminDB,
  adminTimestamp,
  adminFieldValue,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UsageKind = "script" | "voice" | "lipsync" | "edit";

const PRICE_BY_KIND: Record<UsageKind, string> = {
  script: process.env.STRIPE_PRICE_USAGE_SCRIPT!,
  voice: process.env.STRIPE_PRICE_USAGE_VOICE!,
  lipsync: process.env.STRIPE_PRICE_USAGE_LIPSYNC!,
  edit: process.env.STRIPE_PRICE_USAGE_EDIT!,
};

const DEFAULT_TRIAL_CENTS = Number(process.env.TRIAL_CREDIT_CENTS ?? "500");

// Cache en memoria del unit_amount por price
const unitAmountCache = new Map<string, number>();

async function getUnitAmountCents(priceId: string): Promise<number> {
  const cached = unitAmountCache.get(priceId);
  if (typeof cached === "number") return cached;

  const price = await stripe.prices.retrieve(priceId);

  let ua = price.unit_amount;
  if (typeof ua !== "number" && typeof price.unit_amount_decimal === "string") {
    const parsed = Math.round(parseFloat(price.unit_amount_decimal));
    if (Number.isFinite(parsed)) ua = parsed;
  }
  if (typeof ua !== "number") throw new Error(`Price ${priceId} sin unit_amount`);

  unitAmountCache.set(priceId, ua);
  return ua;
}

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

async function safeBody(req: NextRequest) {
  try {
    const raw = await req.json();
    if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  } catch {}
  return {};
}

export async function POST(req: NextRequest) {
  try {
    // 1) Auth (Bearer o idToken en body)
    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;

    const body = await safeBody(req);
    const idTokenFromBody =
      typeof body.idToken === "string" ? body.idToken : undefined;

    const idToken = bearer ?? idTokenFromBody;
    if (!idToken) return bad("Missing ID token", 401);

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // 2) Params
    const kindRaw = body.kind;
    const qtyRaw = body.quantity;

    const allowed: UsageKind[] = ["script", "voice", "lipsync", "edit"];
    const kind =
      typeof kindRaw === "string" && (allowed as string[]).includes(kindRaw)
        ? (kindRaw as UsageKind)
        : undefined;

    const quantity =
      typeof qtyRaw === "number" && qtyRaw > 0 ? Math.floor(qtyRaw) : 1;

    if (!kind) return bad("Invalid kind");
    const priceId = PRICE_BY_KIND[kind];
    if (!priceId) return bad(`Missing price for kind '${kind}' on env`);

    // 3) Doc usuario
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) return bad("User doc not found", 404);

    const user = snap.data() as {
      stripeCustomerId?: string;
      subscription?: { status?: string | null };
      trialCreditCents?: number;
      usage?: Partial<Record<UsageKind, number>>;
    };

    const customerId = user.stripeCustomerId;
    if (!customerId)
      return bad("No Stripe customer. Debes darte de alta primero.", 400);

    // 4) Estado de la suscripción (permitimos trialing o active)
    let subStatus: string | null = null;
    try {
      const subs = await stripe.subscriptions.list({ customer: customerId, limit: 1 });
      if (subs.data[0]) subStatus = subs.data[0].status;
    } catch {
      subStatus = user.subscription?.status ?? null; // fallback
    }

    const canUse = subStatus === "trialing" || subStatus === "active";
    if (!canUse) return bad(`Suscripción no válida (${subStatus ?? "sin estado"})`, 402);

    // 5) Precio unitario y moneda
    const unitCents = await getUnitAmountCents(priceId);
    const price = await stripe.prices.retrieve(priceId);
    const currency = price.currency!;

    // 6) Crédito trial disponible (si hay trial y aún no sembrado → sembrar)
    let credit =
      typeof user.trialCreditCents === "number"
        ? Math.max(0, user.trialCreditCents)
        : undefined;

    if (subStatus === "trialing" && credit == null) {
      credit = DEFAULT_TRIAL_CENTS;
      await userRef.set(
        { trialCreditCents: credit, lastUpdated: adminTimestamp.now() },
        { merge: true }
      );
    }

    const creditNow = typeof credit === "number" ? credit : 0;

    // 7) Cantidad gratis con crédito + de pago
    const freeQty =
      creditNow > 0 ? Math.min(quantity, Math.floor(creditNow / unitCents)) : 0;
    const paidQty = quantity - freeQty;

    // 8) Descontar crédito (atómico)
    if (freeQty > 0) {
      await userRef.update({
        trialCreditCents: adminFieldValue.increment(-freeQty * unitCents),
        lastUpdated: adminTimestamp.now(),
      });
    }

    // 8bis) Parte de pago → invoice item en céntimos
    let invoiceItemId: string | null = null;
    if (paidQty > 0) {
      const chargedCents = paidQty * unitCents;
      const ii = await stripe.invoiceItems.create({
        customer: customerId,
        amount: chargedCents,
        currency,
        description: `usage:${kind}`,
        metadata: { uid, kind, freeQty: String(freeQty), paidQty: String(paidQty) },
      });
      invoiceItemId = ii.id;
    }

    // 9) Contadores de uso (locales)
    await userRef.update({
      [`usage.${kind}`]: adminFieldValue.increment(quantity),
      lastUpdated: adminTimestamp.now(),
    });

    const creditedCents = freeQty * unitCents;
    const chargedCents = paidQty * unitCents;

    return NextResponse.json(
      {
        ok: true,
        kind,
        quantity,
        unitCents,
        creditedCents,
        chargedCents,
        currency,
        freeQty,
        paidQty,
        invoiceItemId,
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Usage error";
    console.error("❌ /api/billing/usage:", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
