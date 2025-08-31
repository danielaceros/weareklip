// src/app/api/billing/usage/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  adminAuth,
  adminDB,
  adminTimestamp,
  adminFieldValue,
} from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UsageKind = "script" | "voice" | "lipsync" | "edit";

/** Precios METEReD (intervalo DIARIO) por producto */
const PRICE_BY_KIND: Record<UsageKind, string> = {
  script: process.env.STRIPE_PRICE_USAGE_SCRIPT ?? "",
  voice: process.env.STRIPE_PRICE_USAGE_VOICE ?? "",
  lipsync: process.env.STRIPE_PRICE_USAGE_LIPSYNC ?? "",
  edit: process.env.STRIPE_PRICE_USAGE_EDIT ?? "",
};

/** Nombre del evento del Medidor (Stripe Billing Meters) por producto */
const METER_EVENT_BY_KIND: Record<UsageKind, string> = {
  script: process.env.STRIPE_METER_EVENT_SCRIPT ?? "",
  voice: process.env.STRIPE_METER_EVENT_VOICE ?? "",
  lipsync: process.env.STRIPE_METER_EVENT_LIPSYNC ?? "",
  edit: process.env.STRIPE_METER_EVENT_EDIT ?? "",
};

/** Crédito trial por defecto (50€) si no viene en .env */
const DEFAULT_TRIAL_CENTS = Number(process.env.TRIAL_CREDIT_CENTS || "5000");
/** Tope duro de consumo antes de bloquear (por defecto 150€) */
const DAILY_CAP_CENTS = Number(process.env.DAILY_CAP_CENTS || "15000");

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
  if (!priceId) throw new Error("Missing priceId");
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
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
  } catch {
    // ignorar body inválido
  }
  return {};
}

/** Obtener IP del cliente de forma segura */
function getClientIp(req: NextRequest): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

/** Rate limiting por UID/IP (ventana sliding de 1m, máx 20 req) */
const rateLimitMap = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 60_000; // 1 minuto
const MAX_REQS = 20;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  if (!record || now - record.ts > WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, ts: now });
    return true;
  }
  if (record.count >= MAX_REQS) {
    return false;
  }
  record.count++;
  return true;
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

  return await stripe.subscriptions.create({
    customer: customerId,
    collection_method: "charge_automatically",
    items: Object.values(PRICE_BY_KIND).filter(Boolean).map((p) => ({ price: p })),
    proration_behavior: "none",
    metadata: uid ? { plan: "usage", uid } : { plan: "usage" },
  });
}

/** Asegura que la sub tiene items para TODOS los prices definidos */
async function ensureSubscriptionHasAllPrices(subscriptionId: string): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  const existingPriceIds = new Set(
    sub.items.data.map((it) => it.price?.id).filter(Boolean) as string[]
  );

  for (const priceId of Object.values(PRICE_BY_KIND).filter(Boolean)) {
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
  user: any;
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
    const body = await safeBody(req);
    const preview = body.preview === true || body.preview === "true";

    // --- Rate limiting check ---
    const ip = getClientIp(req);
    const rateKeyIp = `ip:${ip}`;
    if (!checkRateLimit(rateKeyIp)) {
      await gaServerEvent("usage_failed", { reason: "rate_limited_ip", ip });
      return bad("Too many requests from this IP, please try later", 429);
    }

    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
    const idToken = bearer ?? (typeof body.idToken === "string" ? body.idToken : undefined);
    if (!idToken) {
      await gaServerEvent("usage_failed", { reason: "missing_id_token" });
      return bad("Missing ID token", 401);
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // 🔐 Rate-limit también por UID
    const rateKeyUid = `uid:${uid}`;
    if (!checkRateLimit(rateKeyUid)) {
      await gaServerEvent("usage_failed", { reason: "rate_limited_uid", uid });
      return bad("Too many requests for this account, slow down", 429);
    }

    const allowed: UsageKind[] = ["script", "voice", "lipsync", "edit"];
    const kind =
      typeof body.kind === "string" && (allowed as string[]).includes(body.kind)
        ? (body.kind as UsageKind)
        : undefined;
    const quantity =
      typeof body.quantity === "number" && body.quantity > 0
        ? Math.floor(body.quantity)
        : 1;
    if (!kind) {
      await gaServerEvent("usage_failed", { uid, reason: "invalid_kind" });
      return bad("Invalid kind");
    }

    await gaServerEvent("usage_attempt", { uid, kind, quantity, preview });

    const priceId = PRICE_BY_KIND[kind];
    if (!priceId) {
      return bad("Price ID not configured for this kind", 500);
    }
    const meterEventName = METER_EVENT_BY_KIND[kind];
    if (!meterEventName) {
      return bad("Meter event not configured for this kind", 500);
    }

    const userRef = adminDB.collection("users").doc(uid);
    let snap = await userRef.get();
    if (!snap.exists) {
      await gaServerEvent("usage_failed", { uid, kind, reason: "user_doc_not_found" });
      return bad("User doc not found", 404);
    }
    let user = snap.data() as any;
    const customerId = user.stripeCustomerId;
    if (!customerId) {
      await gaServerEvent("usage_failed", { uid, kind, reason: "no_stripe_customer" });
      return bad("No Stripe customer. Debes darte de alta primero.", 400);
    }

    // Validación de acceso
    let accessStatus: string | null = null;
    try {
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });
      const access = subs.data.find(
        (s) =>
          s.status !== "canceled" &&
          s.items.data.some((it) => it.price?.id === process.env.STRIPE_PRICE_ACCESS)
      );
      accessStatus = access?.status ?? null;
    } catch (err) {
      console.warn("Fallo en stripe.subscriptions.list:", err);
      accessStatus = user.subscription?.status ?? null;
    }
    if (!(accessStatus === "trialing" || accessStatus === "active")) {
      await gaServerEvent("usage_failed", { uid, kind, reason: "invalid_subscription", accessStatus });
      return bad(`Suscripción no válida (${accessStatus ?? "sin estado"})`, 402);
    }

    // Bloqueo por facturas vencidas
    try {
      const invoices = await stripe.invoices.list({ customer: customerId, limit: 5 });
      const overdue = invoices.data.find(
        (i) =>
          (i.status === "open" || i.status === "uncollectible") &&
          (i.amount_remaining ?? 0) > 0
      );
      if (overdue) {
        const portalUrl = await createBillingPortalUrl(customerId);
        await gaServerEvent("usage_blocked_overdue", { uid, kind, invoice: overdue.id });
        return NextResponse.json(
          {
            ok: false,
            code: "OVERDUE",
            message: "Tienes facturas pendientes de pago.",
            amountRemaining: overdue.amount_remaining,
            portalUrl,
          },
          { status: 402 }
        );
      }
    } catch (err) {
      console.warn("No se pudo verificar facturas vencidas:", err);
    }

    // Sub de consumo
    const usageSub = await getOrCreateUsageSubscription(customerId, uid);
    await ensureSubscriptionHasAllPrices(usageSub.id);
    await maybeResetAfterPaidInvoice({ userRef, user, customerId, usageSubId: usageSub.id });
    snap = await userRef.get();
    user = snap.data();

    const unitCents = await getUnitAmountCents(priceId);
    const price = await stripe.prices.retrieve(priceId);
    const currency = price.currency!;

    let credit = typeof user.trialCreditCents === "number" ? Math.max(0, user.trialCreditCents) : undefined;
    if (accessStatus === "trialing" && credit == null) {
      credit = DEFAULT_TRIAL_CENTS;
      await userRef.set({ trialCreditCents: credit, lastUpdated: adminTimestamp.now() }, { merge: true });
    }
    const creditNow = typeof credit === "number" ? credit : 0;

    const freeQty = creditNow > 0 ? Math.min(quantity, Math.floor(creditNow / unitCents)) : 0;
    const paidQty = quantity - freeQty;
    const chargedCentsThisCall = paidQty * unitCents;

    const pendingLocal = typeof user.pendingLocalCents === "number" ? user.pendingLocalCents : 0;
    const willBe = pendingLocal + chargedCentsThisCall;
    if (pendingLocal >= DAILY_CAP_CENTS || willBe > DAILY_CAP_CENTS) {
      const portalUrl = await createBillingPortalUrl(customerId);
      await gaServerEvent("usage_cap_reached", { uid, kind, pendingLocal });
      return NextResponse.json(
        {
          ok: false,
          code: "CAP_REACHED",
          message: "Has alcanzado el límite de consumo.",
          capCents: DAILY_CAP_CENTS,
          pendingLocalCents: pendingLocal,
          remainingCents: Math.max(0, DAILY_CAP_CENTS - pendingLocal),
          portalUrl,
        },
        { status: 402 }
      );
    }

    // === Si solo es PREVIEW: devolver validación y salir ===
    if (preview) {
      return NextResponse.json({
        ok: true,
        kind,
        quantity,
        unitCents,
        currency,
        freeQty,
        paidQty,
        chargedCents: chargedCentsThisCall,
        capCents: DAILY_CAP_CENTS,
        preview: true,
      });
    }

    // === Ejecución real ===
    if (freeQty > 0) {
      await userRef.update({
        trialCreditCents: adminFieldValue.increment(-freeQty * unitCents),
        lastUpdated: adminTimestamp.now(),
      });
      await gaServerEvent("usage_trial_consumed", { uid, kind, freeQty, unitCents });
    }

    let usageEventId: null | string = null;
    if (paidQty > 0) {
      const idemHeader = req.headers.get("x-idempotency-key");
      const idemBody = typeof body.idem === "string" ? (body.idem as string) : undefined;
      const idem = idemHeader || idemBody || String(Date.now());
      const ident = `${uid}:${kind}:${idem}`;

      const meter = (stripe as unknown as { billing?: { meterEvents?: MeterEventsAPI } }).billing?.meterEvents;
      if (!meter) {
        throw new Error("Stripe Metered Billing no disponible");
      }
      const evt = await meter.create(
        {
          event_name: meterEventName,
          payload: { value: paidQty, stripe_customer_id: customerId },
          identifier: ident,
        },
        { idempotencyKey: ident }
      );
      usageEventId = evt.id;

      if (chargedCentsThisCall > 0) {
        await userRef.update({
          pendingLocalCents: adminFieldValue.increment(chargedCentsThisCall),
          lastUpdated: adminTimestamp.now(),
        });
      }
      await gaServerEvent("usage_paid_recorded", { uid, kind, paidQty, chargedCents: chargedCentsThisCall });
    }

// aquí continua el handler sin cambios previos
    await userRef.update({
      [`usage.${kind}`]: adminFieldValue.increment(quantity),
      lastUpdated: adminTimestamp.now(),
    });

    const creditedCents = freeQty * unitCents;

    const taskRef = adminDB.collection("users").doc(uid).collection("tasks").doc();
    await taskRef.set({
      kind,
      quantity,
      freeQty,
      paidQty,
      unitCents,
      creditedCents,
      chargedCents: chargedCentsThisCall,
      currency,
      usageEventId,
      createdAt: adminTimestamp.now(),
    });

    await gaServerEvent("usage_success", { uid, kind, quantity, freeQty, paidQty });

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
    await gaServerEvent("usage_failed", { reason: msg });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
