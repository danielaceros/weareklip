import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
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

/** Precios METEReD (intervalo DIARIO) por producto */
const PRICE_BY_KIND: Record<UsageKind, string> = {
  script: process.env.STRIPE_PRICE_USAGE_SCRIPT!,
  voice: process.env.STRIPE_PRICE_USAGE_VOICE!,
  lipsync: process.env.STRIPE_PRICE_USAGE_LIPSYNC!,
  edit: process.env.STRIPE_PRICE_USAGE_EDIT!,
};

/** Nombre del evento del Medidor (Stripe Billing Meters) por producto */
const METER_EVENT_BY_KIND: Record<UsageKind, string> = {
  script: process.env.STRIPE_METER_EVENT_SCRIPT!,
  voice: process.env.STRIPE_METER_EVENT_VOICE!,
  lipsync: process.env.STRIPE_METER_EVENT_LIPSYNC!,
  edit: process.env.STRIPE_METER_EVENT_EDIT!,
};

/** Crédito trial por defecto (50€) si no viene en .env */
const DEFAULT_TRIAL_CENTS = Number(process.env.TRIAL_CREDIT_CENTS ?? "5000");
/** Tope duro de consumo antes de bloquear (por defecto 150€) */
const DAILY_CAP_CENTS = Number(process.env.DAILY_CAP_CENTS ?? "15000");

/* ================= Tipos mínimos para Meter Events ================= */
type MeterEventCreateParams = {
  event_name: string;
  payload: {
    value: number;
    stripe_customer_id: string;
  };
  identifier?: string;
  timestamp?: number;
};
type MeterEvent = { id: string };
type MeterEventsAPI = {
  create: (
    params: MeterEventCreateParams,
    options?: { idempotencyKey?: string }
  ) => Promise<MeterEvent>;
};

/* ================= helpers ================= */

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

/** Crea/recupera la sub de consumo con los 4 prices (metered/diarios) */
async function getOrCreateUsageSubscription(
  customerId: string,
  uid?: string
): Promise<Stripe.Subscription> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  const sub = subs.data.find(
    (s) => s.metadata?.plan === "usage" && s.status !== "canceled"
  );
  if (sub) return sub;

  const created = await stripe.subscriptions.create({
    customer: customerId,
    collection_method: "charge_automatically",
    items: Object.values(PRICE_BY_KIND).map((p) => ({ price: p })),
    proration_behavior: "none",
    metadata: uid ? { plan: "usage", uid } : { plan: "usage" },
  });
  return created;
}

/** Asegura que la sub tiene items para TODOS los prices definidos */
async function ensureSubscriptionHasAllPrices(subscriptionId: string): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  const existingPriceIds = new Set(
    sub.items.data.map((it) => it.price?.id).filter(Boolean) as string[]
  );

  for (const priceId of Object.values(PRICE_BY_KIND)) {
    if (!existingPriceIds.has(priceId)) {
      await stripe.subscriptionItems.create({ subscription: subscriptionId, price: priceId });
    }
  }
}

/** URL del portal de facturación para que el usuario pueda pagar/actualizar tarjeta */
async function createBillingPortalUrl(customerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  });
  return session.url;
}

/** Si encontramos una invoice pagada posterior al último reset, reseteamos acumulado local */
async function maybeResetAfterPaidInvoice(args: {
  userRef: FirebaseFirestore.DocumentReference;
  user: {
    pendingLocalResetAt?: FirebaseFirestore.Timestamp;
    pendingLocalCents?: number;
  };
  customerId: string;
  usageSubId: string;
}) {
  const { userRef, user, customerId, usageSubId } = args;

  const list = await stripe.invoices.list({
    customer: customerId,
    subscription: usageSubId,
    limit: 5,
  });

  const paid = list.data.find((i) => i.status === "paid");
  const paidPeriodEnd = typeof paid?.period_end === "number" ? paid!.period_end : undefined;

  if (paid && typeof paidPeriodEnd === "number") {
    const already = user.pendingLocalResetAt?.seconds;
    if (!already || already !== paidPeriodEnd) {
      await userRef.set(
        {
          pendingLocalCents: 0,
          pendingLocalResetAt: adminTimestamp.fromMillis(paidPeriodEnd * 1000),
          lastUpdated: adminTimestamp.now(),
        },
        { merge: true }
      );
    }
  }
}

/* ================= handler ================= */

export async function POST(req: NextRequest) {
  try {
    // 1) Auth
    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;
    const body = await safeBody(req);
    const idToken = bearer ?? (typeof body.idToken === "string" ? body.idToken : undefined);
    if (!idToken) return bad("Missing ID token", 401);
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // 2) Params
    const allowed: UsageKind[] = ["script", "voice", "lipsync", "edit"];
    const kind =
      typeof body.kind === "string" && (allowed as string[]).includes(body.kind)
        ? (body.kind as UsageKind)
        : undefined;
    const quantity =
      typeof body.quantity === "number" && body.quantity > 0
        ? Math.floor(body.quantity)
        : 1;
    if (!kind) return bad("Invalid kind");
    const priceId = PRICE_BY_KIND[kind];
    if (!priceId) return bad(`Missing price for kind '${kind}' on env`);
    const meterEventName = METER_EVENT_BY_KIND[kind];
    if (!meterEventName) return bad(`Missing meter event name for kind '${kind}' on env`);

    // 3) User doc
    const userRef = adminDB.collection("users").doc(uid);
    let snap = await userRef.get();
    if (!snap.exists) return bad("User doc not found", 404);
    let user = snap.data() as {
      stripeCustomerId?: string;
      subscription?: { status?: string | null };
      trialCreditCents?: number;
      usage?: Partial<Record<UsageKind, number>>;
      pendingLocalCents?: number;
      pendingLocalResetAt?: FirebaseFirestore.Timestamp;
    };
    const customerId = user.stripeCustomerId;
    if (!customerId) return bad("No Stripe customer. Debes darte de alta primero.", 400);

    // 4) Validar Access (trialing/active)
    let accessStatus: string | null = null;
    try {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
      const access = subs.data.find((s) => s.metadata?.plan === "access" && s.status !== "canceled");
      accessStatus = access?.status ?? null;
    } catch {
      accessStatus = user.subscription?.status ?? null;
    }
    if (!(accessStatus === "trialing" || accessStatus === "active")) {
      return bad(`Suscripción no válida (${accessStatus ?? "sin estado"})`, 402);
    }

    // 5) Garantizar sub de uso y todos los prices
    const usageSub = await getOrCreateUsageSubscription(customerId, uid);
    await ensureSubscriptionHasAllPrices(usageSub.id);

    // 6) Si detectamos que ya hay una invoice "paid", reseteamos acumulado local
    await maybeResetAfterPaidInvoice({
      userRef,
      user,
      customerId,
      usageSubId: usageSub.id,
    });
    // refrescamos datos del usuario por si hemos reseteado
    snap = await userRef.get();
    user = snap.data() as typeof user;

    // 7) Precio/moneda (para crédito)
    const unitCents = await getUnitAmountCents(priceId);
    const price = await stripe.prices.retrieve(priceId);
    const currency = price.currency!;

    // 8) Crédito trial (sembrar si hace falta)
    let credit =
      typeof user.trialCreditCents === "number" ? Math.max(0, user.trialCreditCents) : undefined;
    if (accessStatus === "trialing" && credit == null) {
      credit = DEFAULT_TRIAL_CENTS;
      await userRef.set({ trialCreditCents: credit, lastUpdated: adminTimestamp.now() }, { merge: true });
    }
    const creditNow = typeof credit === "number" ? credit : 0;

    // 9) Cálculo de “gratis/pago” para esta operación
    const freeQty = creditNow > 0 ? Math.min(quantity, Math.floor(creditNow / unitCents)) : 0;
    const paidQty = quantity - freeQty;
    const chargedCentsThisCall = paidQty * unitCents;

    // 10) Tope duro: si ya llegó o se pasaría del tope, bloqueamos
    const pendingLocal = typeof user.pendingLocalCents === "number" ? user.pendingLocalCents : 0;
    const willBe = pendingLocal + chargedCentsThisCall;

    if (pendingLocal >= DAILY_CAP_CENTS || willBe > DAILY_CAP_CENTS) {
      const portalUrl = await createBillingPortalUrl(customerId);
      const remaining = Math.max(0, DAILY_CAP_CENTS - pendingLocal);

      return NextResponse.json(
        {
          ok: false,
          code: "CAP_REACHED",
          message:
            "Has alcanzado el límite de consumo. Paga la factura pendiente o espera a que se liquide para continuar.",
          capCents: DAILY_CAP_CENTS,
          pendingLocalCents: pendingLocal,
          remainingCents: remaining,
          portalUrl,
        },
        { status: 402 }
      );
    }

    // 11) Descontar crédito trial si aplica
    if (freeQty > 0) {
      await userRef.update({
        trialCreditCents: adminFieldValue.increment(-freeQty * unitCents),
        lastUpdated: adminTimestamp.now(),
      });
    }

// 12) Reportar uso (solo parte de pago) → Meter Events + acumular pendiente local
let usageEventId: string | null = null;
if (paidQty > 0) {
  // Soporte idempotencia: mismo ident si reintentas con la misma key
  const idemHeader = req.headers.get("x-idempotency-key");
  const idemBody = typeof body.idem === "string" ? body.idem : undefined;
  const idem = idemHeader || idemBody || String(Date.now());
  const ident = `${uid}:${kind}:${idem}`;

  const meter = (stripe as unknown as { billing?: { meterEvents?: MeterEventsAPI } })
    .billing?.meterEvents;
  if (!meter || typeof meter.create !== "function") {
    throw new Error("Tu SDK de Stripe no soporta billing.meterEvents.create. Actualiza 'stripe'.");
  }

  const evt = await meter.create(
    {
      event_name: meterEventName,
      payload: { value: paidQty, stripe_customer_id: customerId },
      identifier: ident,
    },
    { idempotencyKey: ident }
  );
  usageEventId = evt.id ?? null;

  if (chargedCentsThisCall > 0) {
    await userRef.update({
      pendingLocalCents: adminFieldValue.increment(chargedCentsThisCall),
      lastUpdated: adminTimestamp.now(),
    });
  }
}



    // 13) Contadores locales (estadísticos)
    await userRef.update({
      [`usage.${kind}`]: adminFieldValue.increment(quantity),
      lastUpdated: adminTimestamp.now(),
    });

    const creditedCents = freeQty * unitCents;

    return NextResponse.json(
      {
        ok: true,
        kind,
        quantity,
        unitCents,
        creditedCents,
        chargedCents: chargedCentsThisCall,
        currency,
        freeQty,
        paidQty,
        usageEventId,
        capCents: DAILY_CAP_CENTS,
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Usage error";
    console.error("❌ /api/billing/usage:", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
